import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { googleAccounts, users } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, fetchEmail, hasGmailScope } from "@/lib/google-oauth";
import { canConnectGmail, getSession, isAllowed, sessionCookie, signSession } from "@/lib/session";
import { STATE_COOKIE } from "../../google/route";

function fail(req: NextRequest, path: string, reason: string) {
  const u = new URL(path, req.url);
  u.searchParams.set(path === "/sign-in" ? "error" : "gmail", reason);
  const res = NextResponse.redirect(u);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [mode, expected] = (req.cookies.get(STATE_COOKIE)?.value ?? "").split(":");
  if (!code || !state || !expected || state !== expected) return fail(req, "/sign-in", "state");

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (e) {
    console.error(e);
    return fail(req, "/sign-in", "exchange");
  }
  const email = await fetchEmail(tokens.access_token);

  if (mode === "gmail") return connectGmail(req, email, tokens);

  if (!isAllowed(email)) return fail(req, "/sign-in", "not-allowed");
  const [user] = await db
    .insert(users)
    .values({ email: email.toLowerCase() })
    .onConflictDoUpdate({ target: users.email, set: { email: email.toLowerCase() } })
    .returning();

  // First sign-in for someone who may read Gmail: go straight on to connecting it.
  const [linked] = await db.select({ id: googleAccounts.id }).from(googleAccounts).where(eq(googleAccounts.userId, user.id));
  const next = !linked && canConnectGmail(email) ? "/api/auth/google?connect=gmail" : "/";

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(sessionCookie(await signSession({ userId: user.id, email: user.email })));
  res.cookies.delete(STATE_COOKIE);
  return res;
}

async function connectGmail(req: NextRequest, email: string, tokens: Awaited<ReturnType<typeof exchangeCode>>) {
  const session = await getSession();
  if (!session) return fail(req, "/sign-in", "state");
  if (!canConnectGmail(session.email)) return fail(req, "/", "not-allowed");
  if (!hasGmailScope(tokens.scope)) return fail(req, "/", "scope");
  if (!tokens.refresh_token) return fail(req, "/", "exchange");

  const [other] = await db.select({ userId: googleAccounts.userId }).from(googleAccounts).where(eq(googleAccounts.email, email));
  if (other && other.userId !== session.userId) return fail(req, "/", "taken");

  const refreshTokenEnc = encrypt(tokens.refresh_token);
  await db
    .insert(googleAccounts)
    .values({ userId: session.userId, email, refreshTokenEnc })
    // A different inbox replaces the old one, and its history starts fresh.
    .onConflictDoUpdate({
      target: googleAccounts.userId,
      set: {
        email,
        refreshTokenEnc,
        needsReconnect: false,
        lastHistoryId: sql`case when ${googleAccounts.email} = excluded.email then ${googleAccounts.lastHistoryId} end`,
      },
    });

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete(STATE_COOKIE);
  return res;
}
