import Link from "next/link";
import { EarningsBars, SplitBar } from "@/components/earnings-bars";
import { StatusDot } from "@/components/status-dot";
import { formatMoney, formatRange, jobName } from "@/lib/format";
import { earnings, syncState } from "@/lib/queries";
import { MarkPaid } from "./mark-paid";
import { PushToggle } from "@/components/push-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const [e, sync] = await Promise.all([earnings(), syncState()]);
  const m = e.month;
  const legend = [
    ["bg-ink", "Paid", m.paid],
    ["bg-ink-3", "Invoiced", m.invoiced],
    ["bg-ink-5", "To invoice", m.toInvoice],
  ] as const;

  return (
    <section>
      <h1 className="text-xs uppercase tracking-wide text-ink-3">{m.label}</h1>
      <p className="num mt-1 text-4xl font-medium tracking-tight">{formatMoney(m.total, e.currency)}</p>
      {m.overdue > 0 && <p className="mt-1 text-sm text-accent">{formatMoney(m.overdue, e.currency)} overdue</p>}

      <div className="mt-5">
        <SplitBar paid={m.paid} invoiced={m.invoiced} toInvoice={m.toInvoice} />
        <ul className="mt-2 flex gap-4 text-xs text-ink-2">
          {legend.map(([cls, label, n]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
              {label} <span className="num">{formatMoney(n, e.currency)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-ink-3">Six months</h2>
        {e.bars.some((b) => b.total > 0) ? (
          <EarningsBars bars={e.bars} currency={e.currency} />
        ) : (
          <p className="text-sm text-ink-3">Nothing invoiced in the last six months. Confirmed jobs show up here.</p>
        )}
      </div>

      {e.otherCurrencies.length > 0 && (
        <p className="mt-3 text-xs text-ink-3">Also billed in {e.otherCurrencies.join(", ")}; not converted.</p>
      )}

      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ink-3">Unpaid</h2>
        {e.unpaid.length ? (
          <ul>
            {e.unpaid.map(({ job, invoice, view, daysOverdue }) => (
              <li key={job.id} className="flex items-center gap-3">
                <Link href={`/jobs/${job.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 active:opacity-60">
                  <StatusDot status={job.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{jobName(job)}</span>
                      <span className="num shrink-0">{formatMoney(invoice.amount, invoice.currency ?? job.currency)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-sm text-ink-3">
                      <span className="truncate">{formatRange(job.startDate, job.endDate)}</span>
                      <span className={`shrink-0 ${view === "overdue" ? "text-accent" : ""}`}>
                        {view === "overdue" ? `${daysOverdue}d overdue` : view === "invoiced" ? "Invoiced" : "To invoice"}
                      </span>
                    </div>
                  </div>
                </Link>
                <MarkPaid jobId={job.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-ink-3">Nothing owed.</p>
        )}
      </div>

      <div className="mt-12">
        <PushToggle />
      </div>

      <footer className="mt-6 flex items-center justify-between text-xs text-ink-3">
        <span>{sync?.email ?? ""}</span>
        <form action="/api/auth/signout" method="post">
          <button type="submit">Sign out</button>
        </form>
      </footer>
    </section>
  );
}
