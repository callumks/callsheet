import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./session";

/** The cron services send `Authorization: Bearer $CRON_SECRET`. A signed-in session may also trigger a run. */
export async function authorizeCron(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  return !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
}
