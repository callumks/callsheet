import Link from "next/link";
import { EarningsBars, SplitBar } from "@/components/earnings-bars";
import { Group } from "@/components/group";
import { PageHeader } from "@/components/page-header";
import { PushToggle } from "@/components/push-toggle";
import { formatMoney, formatRange, jobName } from "@/lib/format";
import { earnings, syncState } from "@/lib/queries";
import { MarkPaid } from "./mark-paid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };

const MONTH_NAME: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June",
  Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

export default async function EarningsPage() {
  const [e, sync] = await Promise.all([earnings(), syncState()]);
  const m = e.month;
  const owed = e.unpaid.reduce((n, u) => n + Number(u.invoice.amount ?? 0), 0);
  const stats = [
    ["bg-ink", "Paid", m.paid],
    ["bg-ink-3", "Invoiced", m.invoiced],
    ["bg-ink-4", "To invoice", m.toInvoice],
  ] as const;

  return (
    <section>
      <PageHeader title="Earnings" />

      <div className="rise">
        <div className="label">{MONTH_NAME[m.label] ?? m.label}</div>
        <p className="num-display mt-1 text-[3.25rem] font-medium leading-none">{formatMoney(m.total, e.currency)}</p>
        {m.overdue > 0 && <p className="mt-2 text-sm font-medium text-accent">{formatMoney(m.overdue, e.currency)} overdue</p>}

        <div className="mt-6">
          <SplitBar paid={m.paid} invoiced={m.invoiced} toInvoice={m.toInvoice} />
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {stats.map(([cls, label, n]) => (
              <div key={label}>
                <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                  <span className={`h-2 w-2 rounded-full ${cls}`} />
                  {label}
                </dt>
                <dd className="num mt-1 text-[0.95rem]">{formatMoney(n, e.currency)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="label mb-3 px-1">Last six months</h2>
        {e.bars.some((b) => b.total > 0) ? (
          <EarningsBars bars={e.bars} currency={e.currency} />
        ) : (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-3">Confirmed jobs show up here once they&apos;re booked.</p>
        )}
        {e.otherCurrencies.length > 0 && (
          <p className="mt-3 px-1 text-xs text-ink-3">Also billed in {e.otherCurrencies.join(", ")}. Shown separately, not converted.</p>
        )}
      </section>

      <Group title={owed ? `Unpaid · ${formatMoney(owed, e.currency)}` : "Unpaid"}>
        {e.unpaid.length ? (
          e.unpaid.map(({ job, invoice, view, daysOverdue }) => (
            <div key={job.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/jobs/${job.id}`} className="press min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{jobName(job)}</span>
                  <span className="num shrink-0">{formatMoney(invoice.amount, invoice.currency ?? job.currency)}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-ink-3">{formatRange(job.startDate, job.endDate)}</span>
                  <span className={`shrink-0 ${view === "overdue" ? "font-medium text-accent" : "text-ink-3"}`}>
                    {view === "overdue" ? `${daysOverdue} days overdue` : view === "invoiced" ? "Invoiced" : "To invoice"}
                  </span>
                </div>
              </Link>
              <MarkPaid jobId={job.id} />
            </div>
          ))
        ) : (
          <div className="px-4 py-3.5 text-ink-3">Nothing owed. Nice.</div>
        )}
      </Group>

      <Group title="Settings">
        <PushToggle />
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <div>Gmail</div>
            <div className="mt-0.5 truncate text-sm text-ink-3">{sync?.email ?? "Not connected"}</div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="press h-8 rounded-full bg-ground px-3 text-xs font-medium">Sign out</button>
          </form>
        </div>
      </Group>
    </section>
  );
}
