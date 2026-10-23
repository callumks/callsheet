"use client";

import { useTransition } from "react";
import { setInvoiceStatus } from "./actions";

export function InvoiceActions({ jobId, status }: { jobId: string; status: "to_invoice" | "invoiced" | "paid" | "overdue" | null }) {
  const [pending, start] = useTransition();
  const btn = "rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50";
  return (
    <div className="mt-3 flex gap-2">
      {(status === null || status === "to_invoice") && (
        <button type="button" disabled={pending} className={`${btn} bg-ink text-ground`} onClick={() => start(() => setInvoiceStatus(jobId, "invoiced"))}>
          Mark invoiced
        </button>
      )}
      {status !== "paid" && (
        <button type="button" disabled={pending} className={`${btn} ${status === "to_invoice" || status === null ? "bg-ink-5 text-ink" : "bg-ink text-ground"}`} onClick={() => start(() => setInvoiceStatus(jobId, "paid"))}>
          Mark paid
        </button>
      )}
      {status === "paid" && (
        <button type="button" disabled={pending} className={`${btn} bg-ink-5 text-ink`} onClick={() => start(() => setInvoiceStatus(jobId, "invoiced"))}>
          Not paid yet
        </button>
      )}
    </div>
  );
}
