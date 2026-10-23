import Link from "next/link";
import { Fragment } from "react";
import { format, parseISO } from "date-fns";
import type { Job } from "@/db/schema";
import { eachDay, formatTime, jobName } from "@/lib/format";
import { StatusDot } from "./status-dot";

function DateBlock({ iso, hidden }: { iso: string | null; hidden?: boolean }) {
  if (!iso) return <div className="w-11 shrink-0 text-center text-xs text-ink-3">TBC</div>;
  const d = parseISO(iso);
  return (
    <div className={`w-11 shrink-0 text-center ${hidden ? "invisible" : ""}`} aria-hidden={hidden}>
      <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-3">{format(d, "EEE")}</div>
      <div className="text-[1.35rem] font-semibold leading-tight tracking-tight">{format(d, "d")}</div>
    </div>
  );
}

export function JobRow({ job, hideDate }: { job: Job; hideDate?: boolean }) {
  const days = job.startDate ? eachDay(job.startDate, job.endDate).length : 1;
  const parts = [
    job.callTime ? <span key="t" className="num text-ink-2">{formatTime(job.callTime)}</span> : null,
    days > 1 ? <span key="d">{days} days</span> : null,
    job.location ? <span key="l" className="truncate">{job.location}</span> : null,
  ].filter(Boolean);
  return (
    <li>
      <Link href={`/jobs/${job.id}`} className="press -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface">
        <DateBlock iso={job.startDate} hidden={hideDate} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[1rem] font-medium">{jobName(job)}</span>
            {job.needsReview && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Needs review" />}
          </div>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap text-sm text-ink-3">
            {parts.map((p, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden>·</span>}
                {p}
              </Fragment>
            ))}
          </div>
        </div>
        <StatusDot status={job.status} />
      </Link>
    </li>
  );
}

export function JobList({ jobs, empty }: { jobs: Job[]; empty?: string }) {
  if (!jobs.length) return empty ? <p className="py-3 text-sm text-ink-3">{empty}</p> : null;
  return (
    <ul className="flex flex-col">
      {jobs.map((j, i) => (
        <JobRow key={j.id} job={j} hideDate={i > 0 && jobs[i - 1].startDate === j.startDate} />
      ))}
    </ul>
  );
}
