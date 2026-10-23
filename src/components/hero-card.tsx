import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Job } from "@/db/schema";
import { STATUS_LABEL, formatMoney, formatRange, formatTime, jobName } from "@/lib/format";
import { StatusDot } from "./status-dot";

function relative(start: string | null, today: string): string {
  if (!start) return "Date TBC";
  const d = differenceInCalendarDays(parseISO(start), parseISO(today));
  if (d < 0) return "On now";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 7) return `In ${d} days`;
  return `In ${Math.round(d / 7)} week${d < 11 ? "" : "s"}`;
}

export function HeroCard({ job, today }: { job: Job; today: string }) {
  return (
    <Link href={`/jobs/${job.id}`} className="press rise block rounded-[1.75rem] bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-ink-2">
          <StatusDot status={job.status} />
          {STATUS_LABEL[job.status]}
        </span>
        <span className="rounded-full bg-ground px-2.5 py-1 text-xs font-medium">{relative(job.startDate, today)}</span>
      </div>

      <h2 className="mt-5 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em]">{jobName(job)}</h2>
      <p className="mt-0.5 text-ink-2">
        {formatRange(job.startDate, job.endDate)}
        {job.agency && job.client ? ` · ${job.agency}` : ""}
      </p>

      <div className="mt-6 grid grid-cols-[auto_1fr] items-baseline gap-x-8 gap-y-1">
        <div className="label">Call</div>
        <div className="label">{job.dayRate ? "Day rate" : ""}</div>
        <div className="num-display text-[2.75rem] font-medium leading-none">{formatTime(job.callTime)}</div>
        <div className="num text-lg text-ink-2">{job.dayRate ? formatMoney(job.dayRate, job.currency) : ""}</div>
      </div>

      {job.location && <p className="mt-4 line-clamp-2 text-[0.95rem] text-ink-2">{job.location}</p>}

      {job.needsReview && (
        <p className="mt-4 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">Needs review · {job.reviewReason}</p>
      )}
    </Link>
  );
}
