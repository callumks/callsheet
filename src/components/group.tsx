import type { ReactNode } from "react";

/** iOS-style inset group: one surface, rows separated by hairlines. */
export function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="mt-8">
      {title && <h2 className="label mb-2 px-1">{title}</h2>}
      <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-surface">{children}</div>
      {footer && <p className="mt-2 px-1 text-xs text-ink-3">{footer}</p>}
    </section>
  );
}

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-3 px-4 py-3.5 ${className}`}>{children}</div>;
}
