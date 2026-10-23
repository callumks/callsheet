import { and, asc, eq, isNull, lte } from "drizzle-orm";
import webpush from "web-push";
import { db as defaultDb, type Db } from "@/db";
import { pushSubscriptions, reminders, type PushSubscription, type Reminder } from "@/db/schema";

export type PushPayload = { title: string; body: string; url?: string | null; tag?: string };

export type Sender = (sub: PushSubscription, payload: PushPayload) => Promise<{ gone: boolean }>;

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID keys are not set");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
  configured = true;
}

export const webPushSender: Sender = async (sub, payload) => {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: "high" },
    );
    return { gone: false };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return { gone: true };
    throw e;
  }
};

export function payloadFor(r: Reminder): PushPayload {
  return { title: r.title, body: r.body, url: r.url, tag: r.jobId ? `${r.kind}:${r.jobId}` : r.kind };
}

/** Sends every reminder whose time has come, to every subscribed device. */
export async function sendDueReminders(
  opts: { db?: Db; now?: Date; send?: Sender; staleAfterMs?: number } = {},
): Promise<{ sent: number; skippedStale: number; devices: number; removed: number; failed: number }> {
  const db = opts.db ?? defaultDb;
  const now = opts.now ?? new Date();
  const send = opts.send ?? webPushSender;
  // A night-before push that is a day late is noise; mark it and move on.
  const stale = opts.staleAfterMs ?? 6 * 3_600_000;

  const due = await db
    .select()
    .from(reminders)
    .where(and(isNull(reminders.sentAt), lte(reminders.sendAt, now)))
    .orderBy(asc(reminders.sendAt));
  const subs = await db.select().from(pushSubscriptions);
  const out = { sent: 0, skippedStale: 0, devices: subs.length, removed: 0, failed: 0 };
  if (!due.length) return out;

  const gone = new Set<string>();
  for (const r of due) {
    if (now.getTime() - r.sendAt.getTime() > stale) {
      await db.update(reminders).set({ sentAt: now }).where(eq(reminders.id, r.id));
      out.skippedStale++;
      continue;
    }
    if (!subs.length) continue; // keep it queued until a device subscribes
    let delivered = false;
    for (const s of subs) {
      if (gone.has(s.id)) continue;
      try {
        const res = await send(s, payloadFor(r));
        if (res.gone) gone.add(s.id);
        else delivered = true;
      } catch (e) {
        console.error("push failed", e);
        out.failed++;
      }
    }
    if (delivered) {
      await db.update(reminders).set({ sentAt: now }).where(eq(reminders.id, r.id));
      out.sent++;
    }
  }
  for (const id of gone) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
    out.removed++;
  }
  return out;
}
