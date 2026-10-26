import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { ExpenseRow } from "@/components/expense-row";
import { Group } from "@/components/group";
import { JobList } from "@/components/job-row";
import { BackBar, PageHeader } from "@/components/page-header";
import { expensesForReview } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Needs review" };

export default async function ReviewPage() {
  const [rows, spend] = await Promise.all([
    db.select().from(jobs).where(eq(jobs.needsReview, true)).orderBy(desc(jobs.updatedAt)),
    expensesForReview(),
  ]);
  return (
    <section>
      <BackBar href="/" label="Upcoming" />
      <PageHeader title="Needs review" />
      <p className="-mt-3 mb-6 text-ink-2">The extractor wasn&apos;t sure about these. Open a job, fix anything that&apos;s off, then tap Looks right.</p>
      {rows.length ? (
        <JobList jobs={rows} />
      ) : spend.length ? null : (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-ink-3">All clear.</p>
      )}
      {spend.length > 0 && (
        <Group title="Expenses" footer="Keep counts it in your expenses. Not a work cost removes it.">
          {spend.map((e) => (
            <ExpenseRow key={e.id} expense={e} currency={null} mode="review" />
          ))}
        </Group>
      )}
    </section>
  );
}
