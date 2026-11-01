import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./session";

export type CronCaller = { all: true } | { all: false; userId: string };

/**
 * The cron services send `Authorization: Bearer $CRON_SECRET` and act for
 * everyone. A signed-in session may also trigger a run, for its own data only.
 */
export async function authorizeCron(req: NextRequest): Promise<CronCaller | null> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return { all: true };
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return session ? { all: false, userId: session.userId } : null;
}
