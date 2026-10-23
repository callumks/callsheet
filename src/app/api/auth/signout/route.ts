import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/sign-in", req.url), { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
