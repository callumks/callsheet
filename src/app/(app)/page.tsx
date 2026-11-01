import Link from "next/link";
import { HeroCard } from "@/components/hero-card";
import { ChevronRight } from "@/components/icons";
import { JobList } from "@/components/job-row";
import { Resync } from "@/components/resync";
import { needsReviewCount, syncState, today, upcoming } from "@/lib/queries";
import { canConnectGmail, requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Why connecting Gmail came back without it: set by the OAuth routes.
const GMAIL_ERROR: Record<string, string> = {
  "not-allowed": "Gmail connection isn't open to this account yet.",
  scope: "Tick the Gmail box on Google's screen so Callsheet can read your bookings.",
  exchange: "Google didn't finish connecting Gmail. Try again.",
  taken: "That Gmail inbox is already connected to another Callsheet account.",
};

export default async function UpcomingPage({ searchParams }: PageProps<"/">) {
  const { gmail } = await searchParams;
  const gmailError = typeof gmail === "string" ? GMAIL_ERROR[gmail] : undefined;
  const day = today();
  const { userId, email } = await requireSession();
  const [{ next, list, later, undated }, review, sync] = await Promise.all([
    upcoming(userId, day),
    needsReviewCount(userId),
    syncState(userId),
  ]);
  const nothing = !next && !list.length && !later.length && !undated.length;

  return (
    <Resync title="Upcoming" lastSyncedAt={sync?.lastSyncedAt ?? null}>
      {gmailError && <p className="mb-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">{gmailError}</p>}

      {sync?.needsReconnect && (
        <a href="/api/auth/google?connect=gmail" className="press mb-4 flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          Gmail access expired. Reconnect to keep syncing.
          <ChevronRight />
        </a>
      )}

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
          {!sync && canConnectGmail(email) && (
            <a href="/api/auth/google?connect=gmail" className="press mt-5 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-ground">
              Connect Gmail
            </a>
          )}
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
