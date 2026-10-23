"use client";

import { useTransition } from "react";
import { clearReview } from "./actions";

export function ReviewBanner({ jobId, reason }: { jobId: string; reason: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl bg-ink-5 p-4 text-sm">
      <div>
        <div className="font-medium text-accent">Needs review</div>
        <div className="mt-0.5 text-ink-2">{reason ?? "Check the fields against the email."}</div>
      </div>
      <button type="button" disabled={pending} onClick={() => start(() => clearReview(jobId))} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-ground disabled:opacity-50">
        Looks right
      </button>
    </div>
  );
}
