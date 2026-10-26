"use client";

import { useState, useTransition } from "react";
import { EXPENSE_LABEL } from "@/lib/format";
import { addExpense } from "./actions";

type Kind = "flight" | "hotel" | "transport" | "food" | "kit" | "other";

/** Last row of the expenses group: a button that opens a short form. */
export function AddExpense({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("transport");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [reimbursable, setReimbursable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setOpen(false);
    setDescription("");
    setAmount("");
    setReimbursable(false);
    setError(null);
  };

  const save = () =>
    start(async () => {
      const r = await addExpense(jobId, { kind, description, amount, reimbursable });
      if (r.error) setError(r.error);
      else reset();
    });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="press w-full px-4 py-3.5 text-left font-medium">
        Add expense
      </button>
    );
  }

  const input = "w-full rounded-lg bg-ground px-3 py-2 outline-none ring-1 ring-hairline focus:ring-ink-3";
  return (
    <form
      className="grid gap-3 px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={input}>
          {Object.entries(EXPENSE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input aria-label="Amount" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${input} num text-right`} />
      </div>
      <input aria-label="What for" placeholder="What for (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
      <label className="flex items-center gap-2.5 text-sm text-ink-2">
        <input type="checkbox" checked={reimbursable} onChange={(e) => setReimbursable(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />
        The agency or client will pay me back
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" disabled={pending} className="press h-11 rounded-xl bg-ink text-sm font-medium text-ground disabled:opacity-50">
          {pending ? "Saving" : "Save"}
        </button>
        <button type="button" disabled={pending} onClick={reset} className="press h-11 rounded-xl bg-ground text-sm font-medium">
          Cancel
        </button>
      </div>
    </form>
  );
}
