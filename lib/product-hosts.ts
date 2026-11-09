/**
 * SERVER-ONLY. Which shop pages /api/import-product may fetch.
 * Matching is on whole DNS labels, so "evilaliexpress.com" or
 * "aliexpress.com.evil.io" never match.
 */

const EXACT_OR_SUBDOMAIN = [
  "aliexpress.com",
  "aliexpress.us",
  "myshopify.com",
  "noon.com",
  "etsy.com",
  "alibaba.com",
  "temu.com",
];

const EXACT_ONLY = ["amzn.to", "a.co"];

// amazon.com, amazon.ae, amazon.co.uk, amazon.com.tr, amazon.com.au …
const AMAZON = /^(?:[a-z0-9-]+\.)?amazon\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2,3})$/;
const AMAZON_SUBDOMAIN_OK = /^(?:www|smile|m)\.amazon\./;
// jumia.com.eg, jumia.ma, jumia.com.ng, jumia.co.ke …
const JUMIA = /^(?:www\.)?jumia\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;
const EBAY = /^(?:www\.|m\.)?ebay\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;

export function isAllowedProductHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (EXACT_ONLY.includes(host)) return true;
  for (const base of EXACT_OR_SUBDOMAIN) {
    if (host === base || host.endsWith(`.${base}`)) return true;
  }
  if (AMAZON.test(host)) {
    // bare "amazon.xx" or a known storefront prefix; no arbitrary subdomains
    return host.startsWith("amazon.") || AMAZON_SUBDOMAIN_OK.test(host);
  }
  return JUMIA.test(host) || EBAY.test(host);
}
