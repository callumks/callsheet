"use client";

import { useTransition } from "react";
import { clearReview } from "./actions";

export function ReviewBanner({ jobId, reason }: { jobId: string; reason: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="rise mt-5 rounded-2xl bg-accent-soft p-4">
      <div className="text-sm font-semibold text-accent">Check these details</div>
      <p className="mt-1 text-sm text-ink-2">{reason ?? "The extractor wasn't sure about some fields."} Fix anything below, then confirm.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => clearReview(jobId))}
        className="press mt-3 h-9 rounded-full bg-accent px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        Looks right
      </button>
    </div>
  );
}
