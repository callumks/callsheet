// The five steps, in order, for one sync run. Deterministic: no agent.
// Dependencies are injectable so the whole run can be exercised offline.

import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/db";
import { emails, googleAccounts, type Email } from "@/db/schema";
import { classify as realClassify, type Classification } from "./classify";
import { extract as realExtract, type Extraction } from "./extract";
import { shouldProcess } from "./filter";
import * as realGmail from "./gmail";
import type { MessageBody, MessageMeta } from "./gmail";
import { applyExtraction, wrapFinishedJobs } from "./upsert";

export type PipelineDeps = {
  db: Db;
  now: () => Date;
  accessToken: (account: typeof googleAccounts.$inferSelect) => Promise<string>;
  listNewMessageIds: (token: string, lastHistoryId: string | null) => Promise<{ ids: string[]; historyId: string }>;
  getMessageMeta: (token: string, id: string) => Promise<MessageMeta>;
  getMessageBody: (token: string, id: string) => Promise<MessageBody>;
  classify: (e: MessageBody) => Promise<Classification>;
  extract: (e: MessageBody, label: Classification["label"]) => Promise<Extraction>;
};

export const realDeps: PipelineDeps = {
  db: defaultDb,
  now: () => new Date(),
  accessToken: realGmail.accessTokenFor,
  listNewMessageIds: realGmail.listNewMessageIds,
  getMessageMeta: realGmail.getMessageMeta,
  getMessageBody: realGmail.getMessageBody,
  classify: realClassify,
  extract: realExtract,
};

/** An email that fails this many runs is left for a human; each retry may cost a model call. */
export const MAX_FAILURES = 5;

export type SyncSummary = {
  account: string | null;
  fetched: number;
  retried: number;
  skipped: number;
  filteredOut: number;
  irrelevant: number;
  applied: number;
  errors: { gmailId: string; error: string }[];
  wrapped: number;
  historyId: string | null;
  ms: number;
};

export async function runSync(over: Partial<PipelineDeps> = {}): Promise<SyncSummary> {
  const d: PipelineDeps = { ...realDeps, ...over };
  const started = Date.now();
  const summary: SyncSummary = {
    account: null,
    fetched: 0,
    retried: 0,
    skipped: 0,
    filteredOut: 0,
    irrelevant: 0,
    applied: 0,
    errors: [],
    wrapped: 0,
    historyId: null,
    ms: 0,
  };

  const [account] = await d.db.select().from(googleAccounts).limit(1);
  if (!account) {
    summary.ms = Date.now() - started;
    return summary;
  }
  summary.account = account.email;

  // 1. Fetch
  const token = await d.accessToken(account);
  const { ids: newIds, historyId } = await d.listNewMessageIds(token, account.lastHistoryId);
  summary.fetched = newIds.length;

  // History only lists new mail, so pick up emails an earlier run started and never finished.
  const unfinished = await d.db
    .select({ gmailId: emails.gmailId })
    .from(emails)
    .where(and(isNull(emails.processedAt), lt(emails.failures, MAX_FAILURES)));
  const ids = [...new Set([...newIds, ...unfinished.map((u) => u.gmailId)])];
  summary.retried = ids.length - newIds.length;

  // A message that fails before it has a row would be lost once history moves past it.
  let lost = false;

  for (const gmailId of ids) {
    const [seen] = await d.db.select().from(emails).where(eq(emails.gmailId, gmailId)).limit(1);
    if (seen && (seen.processedAt || seen.failures >= MAX_FAILURES)) {
      summary.skipped++;
      continue;
    }

    let row: Email | undefined = seen;
    try {
      const meta = await d.getMessageMeta(token, gmailId);
      if (!row) {
        [row] = await d.db
          .insert(emails)
          .values({
            gmailId: meta.gmailId,
            threadId: meta.threadId,
            from: meta.from,
            subject: meta.subject,
            receivedAt: meta.receivedAt,
          })
          .onConflictDoNothing()
          .returning();
        if (!row) {
          summary.skipped++;
          continue;
        }
      }

      // 2. Filter: headers only.
      if (!shouldProcess(meta).keep) {
        await d.db.update(emails).set({ processedAt: d.now(), error: null }).where(eq(emails.id, row.id));
        summary.filteredOut++;
        continue;
      }

      // 3. Classify. The body exists only inside this iteration.
      const body = await d.getMessageBody(token, gmailId);
      const cls = await d.classify(body);
      if (cls.label === "irrelevant") {
        await d.db
          .update(emails)
          .set({ classifiedAs: "irrelevant", processedAt: d.now(), error: null })
          .where(eq(emails.id, row.id));
        summary.irrelevant++;
        continue;
      }

      // 4. Extract. 5. Upsert.
      const extraction = await d.extract(body, cls.label);
      await applyExtraction({ email: row, label: cls.label, extraction, now: d.now() }, d.db);
      await d.db
        .update(emails)
        .set({ classifiedAs: cls.label, processedAt: d.now(), error: null })
        .where(eq(emails.id, row.id));
      summary.applied++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({ gmailId, error: msg });
      if (row) {
        await d.db
          .update(emails)
          .set({ error: msg.slice(0, 1000), failures: sql`${emails.failures} + 1` })
          .where(eq(emails.id, row.id));
      } else {
        lost = true;
      }
    }
  }

  summary.wrapped = await wrapFinishedJobs(d.db, d.now().toISOString().slice(0, 10));

  await d.db
    .update(googleAccounts)
    .set({ lastHistoryId: lost ? account.lastHistoryId : historyId, lastSyncedAt: d.now() })
    .where(eq(googleAccounts.id, account.id));
  summary.historyId = lost ? account.lastHistoryId : historyId;
  summary.ms = Date.now() - started;
  return summary;
}
