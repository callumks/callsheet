import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Public: sign-in, the OAuth routes, the push service worker and PWA assets.
// Cron routes check CRON_SECRET themselves.
const PUBLIC = [/^\/sign-in$/, /^\/api\/auth\//, /^\/api\/cron\//, /^\/sw\.js$/, /^\/manifest\.webmanifest$/];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  // External agent runtime: bearer token, tools only.
  const agentToken = process.env.AGENT_TOKEN;
  if (agentToken && pathname.startsWith("/api/tools/") && req.headers.get("authorization") === `Bearer ${agentToken}`) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/sign-in", req.url));
}

export const config = {
  // Everything except static assets.
  matcher: ["/((?!_next/|favicon\\.ico|icon|apple-icon|.*\\.(?:png|svg|ico|webp)$).*)"],
};
