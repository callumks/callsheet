import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "cs_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type Session = { userId: string; email: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ email: s.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    // Sessions from before there were users carry an email as the subject: sign in again.
    if (typeof payload.sub !== "string" || !UUID.test(payload.sub)) return null;
    if (typeof payload.email !== "string" || !isAllowed(payload.email)) return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** A comma-separated list of emails; `*` lets anyone in. */
function inList(raw: string | undefined, email: string): boolean {
  const list = (raw ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes("*") || list.includes(email.trim().toLowerCase());
}

/** Who may sign in. ALLOWED_EMAIL is the older single-address form. */
export function isAllowed(email: string): boolean {
  return inList(process.env.ALLOWED_EMAILS ?? process.env.ALLOWED_EMAIL, email);
}

/**
 * Who may connect Gmail. While the Google app is unverified, only its test
 * users can grant gmail.readonly, so this list should match them.
 */
export function canConnectGmail(email: string): boolean {
  return inList(process.env.GMAIL_EMAILS ?? process.env.ALLOWED_EMAIL, email);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Not signed in");
  return s;
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}
