import Link from "next/link";
import { HeroCard } from "@/components/hero-card";
import { JobList } from "@/components/job-row";
import { Resync } from "@/components/resync";
import { needsReviewCount, syncState, today, upcoming } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function UpcomingPage() {
  const day = today();
  const [{ next, list, later, undated }, review, sync] = await Promise.all([upcoming(day), needsReviewCount(), syncState()]);
  const nothing = !next && !list.length && !later.length && !undated.length;

  return (
    <Resync lastSyncedAt={sync?.lastSyncedAt ?? null}>
      <h1 className="sr-only">Upcoming</h1>

      {review > 0 && (
        <Link href="/review" className="mb-4 block text-sm text-accent">
          {review === 1 ? "1 job needs review" : `${review} jobs need review`} →
        </Link>
      )}

      {next ? (
        <HeroCard job={next.job} today={day} />
      ) : nothing ? (
        <div className="rounded-3xl bg-ink-5 p-5">
          <h2 className="text-xl font-semibold tracking-tight">Nothing booked</h2>
          <p className="mt-1 text-ink-2">
            {sync ? "New bookings show up here within 15 minutes of landing in your inbox." : "Connect Gmail to start."}
          </p>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ink-3">Next 14 days</h2>
        <JobList jobs={list.map((r) => r.job)} empty={next ? "Nothing else in the next two weeks." : undefined} />
      </section>

      {later.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-ink-3">Later</h2>
          <JobList jobs={later.map((r) => r.job)} />
        </section>
      )}

      {undated.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-ink-3">No date yet</h2>
          <JobList jobs={undated} />
        </section>
      )}
    </Resync>
  );
}
