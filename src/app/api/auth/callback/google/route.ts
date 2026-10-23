import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { googleAccounts } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, fetchEmail, hasGmailScope } from "@/lib/google-oauth";
import { isAllowed, sessionCookie, signSession } from "@/lib/session";
import { STATE_COOKIE } from "../../google/route";

function fail(req: NextRequest, reason: string) {
  const u = new URL("/sign-in", req.url);
  u.searchParams.set("error", reason);
  const res = NextResponse.redirect(u);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return fail(req, "state");

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (e) {
    console.error(e);
    return fail(req, "exchange");
  }

  const email = await fetchEmail(tokens.access_token);
  if (!isAllowed(email)) return fail(req, "not-allowed");
  if (!hasGmailScope(tokens.scope)) return fail(req, "scope");

  if (tokens.refresh_token) {
    await db
      .insert(googleAccounts)
      .values({ email, refreshTokenEnc: encrypt(tokens.refresh_token) })
      .onConflictDoUpdate({
        target: googleAccounts.email,
        set: { refreshTokenEnc: encrypt(tokens.refresh_token) },
      });
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(sessionCookie(await signSession(email)));
  res.cookies.delete(STATE_COOKIE);
  return res;
}
