import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, type AuthMode } from "@/lib/google-oauth";
import { canConnectGmail, getSession } from "@/lib/session";

export const STATE_COOKIE = "cs_oauth_state";

// `?connect=gmail` adds Gmail to the signed-in user; anything else signs in.
// The mode rides in the state cookie so the callback knows which flow it is finishing.
export async function GET(req: NextRequest) {
  let mode: AuthMode = "sign-in";
  let hint: string | undefined;
  if (req.nextUrl.searchParams.get("connect") === "gmail") {
    const session = await getSession();
    if (!session) return NextResponse.redirect(new URL("/sign-in", req.url));
    if (!canConnectGmail(session.email)) return NextResponse.redirect(new URL("/?gmail=not-allowed", req.url));
    mode = "gmail";
    hint = session.email;
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(state, mode, hint));
  res.cookies.set({
    name: STATE_COOKIE,
    value: `${mode}:${state}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
