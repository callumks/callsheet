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
      className="press h-8 shrink-0 rounded-full bg-ground px-3 text-xs font-medium disabled:opacity-50"
    >
      {pending ? "Saving" : "Paid"}
    </button>
  );
}
