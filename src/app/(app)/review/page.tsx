import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { JobList } from "@/components/job-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Needs review" };

export default async function ReviewPage() {
  const rows = await db.select().from(jobs).where(eq(jobs.needsReview, true)).orderBy(desc(jobs.updatedAt));
  return (
    <section>
      <Link href="/" className="text-sm text-ink-3">← Upcoming</Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Needs review</h1>
      <p className="mt-1 text-sm text-ink-2">The extractor wasn&apos;t sure about these. Open one, fix any field, then tap Looks right.</p>
      <div className="mt-4">
        <JobList jobs={rows} empty="Everything checks out." />
      </div>
    </section>
  );
}
