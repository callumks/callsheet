"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Expense } from "@/db/schema";
import { EXPENSE_LABEL, formatDay, formatMoney } from "@/lib/format";
import { deleteExpense, keepExpense, setExpenseReimbursed } from "@/app/(app)/jobs/[id]/actions";
import { BedIcon, CarIcon, PlaneIcon, ReceiptIcon } from "./icons";

const ICON = { flight: PlaneIcon, hotel: BedIcon, transport: CarIcon, food: ReceiptIcon, kit: ReceiptIcon, other: ReceiptIcon } as const;

function payback(e: Expense) {
  if (!e.reimbursable) return null;
  return e.reimbursedAt ? "Paid back" : "To be paid back";
}

/**
 * One expense in an inset group.
 * - `manage`: tap to reveal paid-back and remove (job page).
 * - `review`: shows why it was held, with keep / not work (review page).
 * - `view`: a link to its job (earnings).
 */
export function ExpenseRow({
  expense: e,
  currency,
  context,
  href,
  mode,
}: {
  expense: Expense;
  currency: string | null;
  context?: string;
  href?: string;
  mode: "manage" | "review" | "view";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const Icon = ICON[e.kind];
  const sub = [context, formatDay(e.incurredOn), payback(e)].filter(Boolean).join(" · ");
  const btn = "press h-9 rounded-full px-4 text-sm font-medium disabled:opacity-50";

  const body = (
    <>
      <Icon className="h-[1.1rem] w-[1.1rem] shrink-0 text-ink-3" />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate">{e.description ?? EXPENSE_LABEL[e.kind]}</span>
          {e.needsReview && mode !== "review" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Needs review" />}
        </div>
        <div className="truncate text-sm text-ink-3">{sub}</div>
      </div>
      <span className="num shrink-0">{formatMoney(e.amount, e.currency ?? currency)}</span>
    </>
  );

  if (mode === "view") {
    const cls = "press flex items-center gap-3 px-4 py-3.5";
    return href ? (
      <Link href={href} className={cls}>
        {body}
      </Link>
    ) : (
      <div className={cls}>{body}</div>
    );
  }

  if (mode === "review") {
    return (
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-3">{body}</div>
        <p className="mt-2 text-sm text-accent">{e.reviewReason ? e.reviewReason[0].toUpperCase() + e.reviewReason.slice(1) + "." : "Check this one."}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={pending} onClick={() => start(() => keepExpense(e.id))} className={`${btn} bg-ink text-ground`}>
            Keep
          </button>
          <button type="button" disabled={pending} onClick={() => start(() => deleteExpense(e.id))} className={`${btn} bg-ground`}>
            Not a work cost
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-3 px-4 py-3.5">
        {body}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 px-4 pb-3.5">
          {e.needsReview && (
            <button type="button" disabled={pending} onClick={() => start(() => keepExpense(e.id))} className={`${btn} bg-ink text-ground`}>
              Looks right
            </button>
          )}
          {e.reimbursable && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => setExpenseReimbursed(e.id, !e.reimbursedAt))}
              className={`${btn} bg-ground`}
            >
              {e.reimbursedAt ? "Not paid back yet" : "Mark paid back"}
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => start(() => deleteExpense(e.id))} className={`${btn} bg-ground text-accent`}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
