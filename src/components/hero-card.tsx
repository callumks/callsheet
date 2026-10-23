import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Job } from "@/db/schema";
import { STATUS_LABEL, formatRange, formatTime, jobName } from "@/lib/format";
import { StatusDot } from "./status-dot";

function relative(start: string | null, today: string): string {
  if (!start) return "";
  const d = differenceInCalendarDays(parseISO(start), parseISO(today));
  if (d < 0) return "On now";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

export function HeroCard({ job, today }: { job: Job; today: string }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-3xl bg-ink-5 p-5 active:opacity-80"
    >
      <div className="flex items-center justify-between text-sm text-ink-2">
        <span className="flex items-center gap-2">
          <StatusDot status={job.status} />
          {STATUS_LABEL[job.status]}
        </span>
        <span>{relative(job.startDate, today)}</span>
      </div>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight">{jobName(job)}</h2>
      <p className="mt-1 text-ink-2">{formatRange(job.startDate, job.endDate)}</p>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-3">Call</div>
          <div className="num text-4xl font-medium tracking-tight">{formatTime(job.callTime)}</div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-xs uppercase tracking-wide text-ink-3">Where</div>
          <div className="truncate">{job.location ?? "TBC"}</div>
        </div>
      </div>
      {job.needsReview && (
        <p className="mt-5 text-sm text-accent">Needs review · {job.reviewReason}</p>
      )}
    </Link>
  );
}
