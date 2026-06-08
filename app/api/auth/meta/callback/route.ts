import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
}

interface AdAccountsResponse {
  data: AdAccount[];
}

async function exchangeCode(code: string): Promise<TokenResponse> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;

  const url = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json() as Promise<TokenResponse>;
}

async function exchangeForLongLived(shortToken: string): Promise<TokenResponse> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;

  const url = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Long-lived token exchange failed: ${err}`);
  }
  return res.json() as Promise<TokenResponse>;
}

async function fetchAdAccounts(accessToken: string): Promise<AdAccount[]> {
  const url = new URL("https://graph.facebook.com/v22.0/me/adaccounts");
  url.searchParams.set("fields", "id,name,account_status");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch ad accounts: ${err}`);
  }
  const data = (await res.json()) as AdAccountsResponse;
  return data.data ?? [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/advertising?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/advertising?error=missing_params", request.url)
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("meta_oauth_state")?.value;
  cookieStore.delete("meta_oauth_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/advertising?error=state_mismatch", request.url)
    );
  }

  try {
    const shortToken = await exchangeCode(code);
    const longToken = await exchangeForLongLived(shortToken.access_token);

    const expiresIn = longToken.expires_in ?? 5184000; // ~60 days default
    const tokenExpiresAt = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    const accounts = await fetchAdAccounts(longToken.access_token);

    // Store token + accounts in a short-lived httpOnly cookie to avoid
    // exposing the access token in the URL (browser history, server logs).
    const sessionPayload = Buffer.from(
      JSON.stringify({
        token: longToken.access_token,
        expires: tokenExpiresAt,
        accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      })
    ).toString("base64");

    const response = NextResponse.redirect(
      new URL("/advertising?connected=true", request.url)
    );
    response.cookies.set("meta_session", sessionPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 120, // 2-minute window to consume
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Meta OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/advertising?error=auth_failed", request.url)
    );
  }
}
