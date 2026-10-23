import type { MonthBar } from "@/lib/queries";
import { formatMoney } from "@/lib/format";

/** Six months, one bar each. Paid is solid ink, invoiced is ink-3, to-invoice is outlined. */
export function EarningsBars({ bars, currency }: { bars: MonthBar[]; currency: string }) {
  const max = Math.max(1, ...bars.map((b) => b.total));
  return (
    <div className="flex h-36 gap-2" role="img" aria-label="Earnings by month for the last six months">
      {bars.map((b) => {
        const pct = (n: number) => `${(n / max) * 100}%`;
        return (
          <div key={b.month} className="flex flex-1 flex-col items-center gap-1.5" title={`${b.label}: ${formatMoney(b.total, currency)}`}>
            <div className="flex w-full flex-1 flex-col-reverse overflow-hidden rounded-md">
              <div className="w-full bg-ink" style={{ height: pct(b.paid) }} />
              <div className="w-full bg-ink-3" style={{ height: pct(b.invoiced) }} />
              <div className="w-full border-x-2 border-t-2 border-ink-3 bg-ground" style={{ height: pct(b.toInvoice) }} />
            </div>
            <span className="text-xs text-ink-3">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SplitBar({ paid, invoiced, toInvoice }: { paid: number; invoiced: number; toInvoice: number }) {
  const total = paid + invoiced + toInvoice;
  if (!total) return <div className="h-2 rounded-full bg-ink-5" />;
  const w = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Paid ${Math.round((paid / total) * 100)}%, invoiced ${Math.round((invoiced / total) * 100)}%, to invoice ${Math.round((toInvoice / total) * 100)}%`}>
      <div className="bg-ink" style={{ width: w(paid) }} />
      <div className="bg-ink-3" style={{ width: w(invoiced) }} />
      <div className="bg-ink-5" style={{ width: w(toInvoice) }} />
    </div>
  );
}
