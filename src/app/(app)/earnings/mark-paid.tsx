"use client";

import { useTransition } from "react";
import { setInvoiceStatus } from "../jobs/[id]/actions";

export function MarkPaid({ jobId }: { jobId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setInvoiceStatus(jobId, "paid"))}
      className="shrink-0 rounded-full bg-ink-5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
    >
      {pending ? "…" : "Paid"}
    </button>
  );
}
