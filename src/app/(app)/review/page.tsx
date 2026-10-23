import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { JobList } from "@/components/job-row";
import { BackBar, PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Needs review" };

export default async function ReviewPage() {
  const rows = await db.select().from(jobs).where(eq(jobs.needsReview, true)).orderBy(desc(jobs.updatedAt));
  return (
    <section>
      <BackBar href="/" label="Upcoming" />
      <PageHeader title="Needs review" />
      <p className="-mt-3 mb-6 text-ink-2">The extractor wasn&apos;t sure about these. Open one, fix anything that&apos;s off, then tap Looks right.</p>
      {rows.length ? (
        <JobList jobs={rows} />
      ) : (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-ink-3">All clear.</p>
      )}
    </section>
  );
}
