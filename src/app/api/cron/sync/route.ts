import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runSync } from "@/lib/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const caller = await authorizeCron(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const runs = await runSync({}, caller.all ? {} : { userId: caller.userId });
    const applied = runs.reduce((n, r) => n + r.applied, 0);
    const fetched = runs.reduce((n, r) => n + r.fetched, 0);
    return NextResponse.json({ applied, fetched, runs });
  } catch (e) {
    console.error("sync failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "sync failed" }, { status: 500 });
  }
}

export const POST = GET;
