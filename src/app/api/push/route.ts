import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { webPushSender } from "@/lib/push";

const Sub = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

// Subscribe this device.
export async function POST(req: NextRequest) {
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent") })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: keys.p256dh, auth: keys.auth } })
    .returning();
  // Confirm with a test push so a broken setup shows up immediately.
  if (req.nextUrl.searchParams.get("test") === "1") {
    await webPushSender(row, { title: "Callsheet", body: "Notifications are on.", url: "/" }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}

// Unsubscribe this device.
export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
  return NextResponse.json({ ok: true });
}
