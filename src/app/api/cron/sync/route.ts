import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runSync } from "@/lib/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await authorizeCron(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const summary = await runSync();
    return NextResponse.json(summary);
  } catch (e) {
    console.error("sync failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "sync failed" }, { status: 500 });
  }
}

export const POST = GET;
