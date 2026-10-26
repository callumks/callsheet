import Link from "next/link";
import { HeroCard } from "@/components/hero-card";
import { ChevronRight } from "@/components/icons";
import { JobList } from "@/components/job-row";
import { Resync } from "@/components/resync";
import { needsReviewCount, syncState, today, upcoming } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function UpcomingPage() {
  const day = today();
  const [{ next, list, later, undated }, review, sync] = await Promise.all([upcoming(day), needsReviewCount(), syncState()]);
  const nothing = !next && !list.length && !later.length && !undated.length;

  return (
    <Resync title="Upcoming" lastSyncedAt={sync?.lastSyncedAt ?? null}>
      {review > 0 && (
        <Link href="/review" className="press mb-4 flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          {review === 1 ? "1 item needs a quick check" : `${review} items need a quick check`}
          <ChevronRight />
        </Link>
      )}

      {next ? (
        <HeroCard job={next.job} today={day} />
      ) : nothing ? (
        <div className="rise rounded-[1.75rem] bg-surface px-5 py-8 text-center">
          <span className="dot dot-option_1 h-3 w-3" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Nothing booked yet</h2>
          <p className="mx-auto mt-1 max-w-[16rem] text-sm text-ink-2">
            {sync ? "New bookings appear here within 15 minutes of landing in your inbox." : "Connect Gmail and your bookings will appear here."}
          </p>
        </div>
      ) : null}

      {(next || list.length > 0) && (
        <section className="mt-9">
          <h2 className="label mb-2">Next two weeks</h2>
          <JobList jobs={list.map((r) => r.job)} empty="Nothing else in the next two weeks." />
        </section>
      )}

      {later.length > 0 && (
        <section className="mt-9">
          <h2 className="label mb-2">Later</h2>
          <JobList jobs={later.map((r) => r.job)} />
        </section>
      )}

      {undated.length > 0 && (
        <section className="mt-9">
          <h2 className="label mb-2">Date to confirm</h2>
          <JobList jobs={undated} />
        </section>
      )}
    </Resync>
  );
}
