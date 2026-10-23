import Link from "next/link";
import type { Job } from "@/db/schema";
import { formatRange, formatTime, jobName } from "@/lib/format";
import { StatusDot } from "./status-dot";

export function JobRow({ job }: { job: Job }) {
  return (
    <li>
      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 py-3 active:opacity-60">
        <StatusDot status={job.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium">{jobName(job)}</span>
            <span className="num shrink-0 text-sm text-ink-2">{job.callTime ? formatTime(job.callTime) : ""}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-sm text-ink-3">
            <span className="truncate">{formatRange(job.startDate, job.endDate)}{job.location ? ` · ${job.location}` : ""}</span>
            {job.needsReview && <span className="shrink-0 text-accent">Review</span>}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function JobList({ jobs, empty }: { jobs: Job[]; empty?: string }) {
  if (!jobs.length) return empty ? <p className="py-3 text-sm text-ink-3">{empty}</p> : null;
  return (
    <ul>
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} />
      ))}
    </ul>
  );
}
