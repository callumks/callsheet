import type { MonthBar } from "@/lib/queries";

function compact(n: number, currency: string) {
  if (!n) return "";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}

/** Six months. Paid is ink, invoiced ink-3, to-invoice ink-4. The current month is labelled in ink. */
export function EarningsBars({ bars, currency }: { bars: MonthBar[]; currency: string }) {
  const max = Math.max(1, ...bars.map((b) => b.total));
  return (
    <div className="flex h-44 gap-2.5" role="img" aria-label="Earnings by month for the last six months">
      {bars.map((b, i) => {
        const current = i === bars.length - 1;
        const pct = (n: number) => `${(n / max) * 100}%`;
        return (
          <div key={b.month} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 flex-col justify-end">
              <span className={`num mb-1 text-center text-[0.68rem] ${current ? "text-ink" : "text-ink-3"}`}>{compact(b.total, currency)}</span>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-lg" style={{ height: pct(b.total) }}>
                <div className="w-full shrink-0 bg-ink" style={{ height: b.total ? `${(b.paid / b.total) * 100}%` : 0 }} />
                <div className="w-full shrink-0 bg-ink-3" style={{ height: b.total ? `${(b.invoiced / b.total) * 100}%` : 0 }} />
                <div className="w-full shrink-0 bg-ink-4" style={{ height: b.total ? `${(b.toInvoice / b.total) * 100}%` : 0 }} />
              </div>
              {!b.total && <div className="h-1 w-full rounded-full bg-ink-4" />}
            </div>
            <span className={`text-xs ${current ? "font-medium text-ink" : "text-ink-3"}`}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SplitBar({ paid, invoiced, toInvoice }: { paid: number; invoiced: number; toInvoice: number }) {
  const total = paid + invoiced + toInvoice;
  if (!total) return <div className="h-2.5 rounded-full bg-ink-4" />;
  const parts = [
    ["bg-ink", paid],
    ["bg-ink-3", invoiced],
    ["bg-ink-4", toInvoice],
  ] as const;
  return (
    <div
      className="flex h-2.5 gap-1"
      role="img"
      aria-label={`Paid ${Math.round((paid / total) * 100)}%, invoiced ${Math.round((invoiced / total) * 100)}%, to invoice ${Math.round((toInvoice / total) * 100)}%`}
    >
      {parts.filter(([, n]) => n > 0).map(([cls, n]) => (
        <div key={cls} className={`${cls} rounded-full`} style={{ width: `${(n / total) * 100}%` }} />
      ))}
    </div>
  );
}
