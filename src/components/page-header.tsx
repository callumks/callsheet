import type { ReactNode } from "react";

/** Large-title header, Things / iOS style. */
export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="label mb-1">{eyebrow}</div>}
        <h1 className="truncate text-[1.85rem] font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}

export { BackBar } from "./back-bar";
