import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { scheduleOverdue } from "@/lib/overdue";
import { sendDueReminders } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await authorizeCron(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const overdue = await scheduleOverdue();
  const push = await sendDueReminders();
  return NextResponse.json({ overdue, push });
}

export const POST = GET;
