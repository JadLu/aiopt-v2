/**
 * SERVER-ONLY. Fetches a user-supplied URL with SSRF protection.
 *
 * - https only, no credentials, port 443, no IP-literal / local hostnames.
 * - The DNS answer is validated AND pinned to the connection (custom `lookup`
 *   on node:https), so a hostname cannot resolve to a public IP at check time
 *   and a private one at connect time (DNS rebinding).
 * - Redirects are never followed automatically: every hop is re-parsed and
 *   re-checked (including the caller's host allowlist). Max 5 hops.
 * - One overall deadline (default 5 s) covers DNS, connect, redirects and body.
 * - Body is streamed with a hard byte cap, applied AFTER decompression.
 */
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import zlib from "node:zlib";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

export type FetchErrorCode = "blocked" | "unsupported_host" | "timeout" | "too_large" | "bad_type" | "upstream";

export class FetchBlockedError extends Error {
  constructor(public readonly code: FetchErrorCode, message?: string) {
    super(message ?? code);
    this.name = "FetchBlockedError";
  }
}

// ── Address classification ─────────────────────────────────────────────────
const blocklist = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocklist.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
  ["64:ff9b::", 96], ["2002::", 16], ["2001:db8::", 32],
] as const) blocklist.addSubnet(addr, prefix, "ipv6");

/** True only for globally routable unicast addresses. */
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !blocklist.check(address, "ipv4");
  if (family === 6) {
    const lower = address.toLowerCase();
    const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (dotted) return isPublicAddress(dotted[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (hex) {
      const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return !blocklist.check(address, "ipv6");
  }
  return false;
}

// ── URL checks ─────────────────────────────────────────────────────────────
export function parseAndCheckUrl(raw: string, allowHost?: (hostname: string) => boolean): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new FetchBlockedError("blocked", "Invalid URL"); }

  if (url.protocol !== "https:") throw new FetchBlockedError("blocked", "Only https links are allowed");
  if (url.username || url.password) throw new FetchBlockedError("blocked", "Links with credentials are not allowed");
  if (url.port !== "" && url.port !== "443") throw new FetchBlockedError("blocked", "Unusual ports are not allowed");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host || net.isIP(host.replace(/^\[|\]$/g, "")) !== 0 ||
    !host.includes(".") ||
    host === "localhost" ||
    /\.(local|localhost|internal|localdomain|lan|home|corp)$/.test(host)
  ) throw new FetchBlockedError("blocked", "That address is not allowed");

  if (allowHost && !allowHost(host)) throw new FetchBlockedError("unsupported_host", "That site is not supported");
  return url;
}

// ── DNS (validated + pinned) ───────────────────────────────────────────────
export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const defaultResolver: Resolver = (hostname) => dns.promises.lookup(hostname, { all: true });

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

function makeLookup(resolve: Resolver) {
  return (hostname: string, options: { all?: boolean }, cb: LookupCb) => {
    resolve(hostname).then(
      (addrs) => {
        if (addrs.length === 0 || addrs.some((a) => !isPublicAddress(a.address))) {
          return cb(new FetchBlockedError("blocked", "Address not allowed") as unknown as NodeJS.ErrnoException, "");
        }
        if (options?.all) cb(null, addrs.map((a) => ({ address: a.address, family: a.family })));
        else cb(null, addrs[0].address, addrs[0].family);
      },
      (err: unknown) => cb(err as NodeJS.ErrnoException, "")
    );
  };
}

// ── Fetch ──────────────────────────────────────────────────────────────────
export interface SafeFetchOptions {
  /** Applied to the first URL and every redirect hop. */
  allowHost?: (hostname: string) => boolean;
  maxBytes: number;
  /** Over the cap: true → return the prefix (truncated), false → throw too_large. */
  allowTruncate?: boolean;
  accept: string;
  /** Tested against the bare media type, e.g. "text/html". */
  contentTypes: RegExp;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Test seams. */
  resolve?: Resolver;
  request?: typeof https.request;
}

export interface SafeFetchResult {
  finalUrl: URL;
  status: number;
  contentType: string;
  body: Buffer;
  truncated: boolean;
}

type Hop =
  | { kind: "redirect"; location: string }
  | { kind: "done"; status: number; contentType: string; body: Buffer; truncated: boolean };

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const maxRedirects = opts.maxRedirects ?? 5;
  const lookup = makeLookup(opts.resolve ?? defaultResolver);
  const doRequest = opts.request ?? https.request;

  let timedOut = false;
  let active: ClientRequest | null = null;
  const timer = setTimeout(() => { timedOut = true; active?.destroy(); }, timeoutMs);

  try {
    let url = parseAndCheckUrl(rawUrl, opts.allowHost);

    for (let hop = 0; hop <= maxRedirects; hop++) {
      const current = url;
      const result = await new Promise<Hop>((resolve, reject) => {
        const req = doRequest(
          {
            protocol: "https:",
            hostname: current.hostname,
            port: 443,
            path: current.pathname + current.search,
            method: "GET",
            lookup: lookup as never,
            headers: {
              "User-Agent": "POLARIS-SM-Importer/1.0",
              Accept: opts.accept,
              "Accept-Encoding": "identity",
            },
          },
          (res: IncomingMessage) => handle(res, current, resolve, reject)
        );
        active = req;
        req.on("error", (e: unknown) => {
          if (timedOut) return reject(new FetchBlockedError("timeout", "The site took too long to respond"));
          if (e instanceof FetchBlockedError) return reject(e);
          reject(new FetchBlockedError("upstream", "Could not reach the site"));
        });
        req.end();
      });

      if (timedOut) throw new FetchBlockedError("timeout", "The site took too long to respond");
      if (result.kind === "done") {
        return { finalUrl: current, status: result.status, contentType: result.contentType, body: result.body, truncated: result.truncated };
      }
      url = parseAndCheckUrl(new URL(result.location, current).toString(), opts.allowHost);
    }
    throw new FetchBlockedError("upstream", "Too many redirects");
  } catch (e) {
    if (e instanceof FetchBlockedError) throw e;
    if (timedOut) throw new FetchBlockedError("timeout", "The site took too long to respond");
    throw new FetchBlockedError("blocked", "Invalid redirect");
  } finally {
    clearTimeout(timer);
  }

  function handle(
    res: IncomingMessage,
    current: URL,
    resolve: (h: Hop) => void,
    reject: (e: unknown) => void
  ) {
    const status = res.statusCode ?? 0;

    if (REDIRECTS.has(status)) {
      const loc = res.headers.location;
      res.resume();
      if (!loc) return reject(new FetchBlockedError("upstream", "Bad redirect"));
      return resolve({ kind: "redirect", location: loc });
    }
    if (status < 200 || status >= 300) {
      res.resume();
      return reject(new FetchBlockedError("upstream", `The site answered with status ${status}`));
    }

    const contentType = String(res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (!opts.contentTypes.test(contentType)) {
      res.resume();
      return reject(new FetchBlockedError("bad_type", "Unexpected content type"));
    }
    const declared = Number(res.headers["content-length"]);
    if (!opts.allowTruncate && Number.isFinite(declared) && declared > opts.maxBytes) {
      res.resume();
      return reject(new FetchBlockedError("too_large", "File is too large"));
    }

    let stream: Readable = res;
    const enc = String(res.headers["content-encoding"] ?? "identity").toLowerCase();
    if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
    else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
    else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
    else if (enc !== "identity" && enc !== "") {
      res.resume();
      return reject(new FetchBlockedError("upstream", "Unsupported encoding"));
    }

    const chunks: Buffer[] = [];
    let total = 0;
    let finished = false;
    const finish = (truncated: boolean) => {
      if (finished) return;
      finished = true;
      resolve({ kind: "done", status, contentType, body: Buffer.concat(chunks), truncated });
    };
    const fail = (e: unknown) => {
      if (finished) return;
      finished = true;
      reject(e);
    };

    stream.on("data", (chunk: Buffer) => {
      if (finished) return;
      if (total + chunk.length > opts.maxBytes) {
        res.destroy();
        stream.destroy();
        if (!opts.allowTruncate) return fail(new FetchBlockedError("too_large", "File is too large"));
        chunks.push(chunk.subarray(0, opts.maxBytes - total));
        total = opts.maxBytes;
        return finish(true);
      }
      total += chunk.length;
      chunks.push(chunk);
    });
    stream.on("end", () => finish(false));
    stream.on("error", () => fail(timedOut
      ? new FetchBlockedError("timeout", "The site took too long to respond")
      : new FetchBlockedError("upstream", "The site sent an unreadable response")));
    res.on("error", () => fail(timedOut
      ? new FetchBlockedError("timeout", "The site took too long to respond")
      : new FetchBlockedError("upstream", "Connection lost")));
    res.on("close", () => { if (!finished && !res.complete) fail(timedOut
      ? new FetchBlockedError("timeout", "The site took too long to respond")
      : new FetchBlockedError("upstream", "Connection lost")); });
    void current;
  }
}
