"use client";

import { useTransition } from "react";
import { setInvoiceStatus } from "./actions";

type Status = "to_invoice" | "invoiced" | "paid" | "overdue" | null;

export function InvoiceActions({ jobId, status }: { jobId: string; status: Status }) {
  const [pending, start] = useTransition();
  const primary = "press h-11 rounded-xl bg-ink text-sm font-medium text-ground disabled:opacity-50";
  const secondary = "press h-11 rounded-xl bg-ground text-sm font-medium disabled:opacity-50";
  const go = (s: "to_invoice" | "invoiced" | "paid") => () => start(() => setInvoiceStatus(jobId, s));

  if (status === "paid") {
    return (
      <div className="mt-4 grid">
        <button type="button" disabled={pending} className={secondary} onClick={go("invoiced")}>Mark as not paid</button>
      </div>
    );
  }
  if (status === "invoiced" || status === "overdue") {
    return (
      <div className="mt-4 grid">
        <button type="button" disabled={pending} className={primary} onClick={go("paid")}>Mark paid</button>
      </div>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button type="button" disabled={pending} className={primary} onClick={go("invoiced")}>Mark invoiced</button>
      <button type="button" disabled={pending} className={secondary} onClick={go("paid")}>Mark paid</button>
    </div>
  );
}
