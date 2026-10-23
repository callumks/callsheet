import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusDot } from "@/components/status-dot";
import { STATUS_LABEL, formatDay, formatMoney, formatRange, formatTime, jobName } from "@/lib/format";
import { gmailUrl } from "@/lib/gmail";
import { invoiceView, jobDetail } from "@/lib/queries";
import { setInvoiceAmount, updateJobField, type EditableField } from "./actions";
import { InlineField } from "./inline-field";
import { InvoiceActions } from "./invoice-actions";
import { ReviewBanner } from "./review-banner";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const d = await jobDetail(id);
  return { title: d ? jobName(d.job) : "Job" };
}

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const d = await jobDetail(id);
  if (!d) notFound();
  const { job, travel, invoice, reminders, source } = d;
  const view = invoiceView(invoice);

  const save = (field: EditableField) => async (raw: string) => {
    "use server";
    return updateJobField(job.id, field, raw);
  };
  const saveAmount = async (raw: string) => {
    "use server";
    return setInvoiceAmount(job.id, raw);
  };

  const statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
  const h = "mt-8 text-xs uppercase tracking-wide text-ink-3";

  return (
    <article>
      <Link href="/" className="text-sm text-ink-3">← Upcoming</Link>
      <div className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <StatusDot status={job.status} />
        {STATUS_LABEL[job.status]}
      </div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{jobName(job)}</h1>
      <p className="text-ink-2">
        {formatRange(job.startDate, job.endDate)}
        {job.callTime ? ` · call ${formatTime(job.callTime)}` : ""}
      </p>

      {job.needsReview && <ReviewBanner jobId={job.id} reason={job.reviewReason} />}

      <h2 className={h}>Job</h2>
      <InlineField label="Status" value={job.status} display={STATUS_LABEL[job.status]} type="select" options={statusOptions} onSave={save("status")} />
      <InlineField label="Client" value={job.client} onSave={save("client")} />
      <InlineField label="Agency" value={job.agency} onSave={save("agency")} />
      <InlineField label="Booker" value={job.booker} onSave={save("booker")} />
      <InlineField label="Type" value={job.jobType} onSave={save("jobType")} />

      <h2 className={h}>When</h2>
      <InlineField label="Start" value={job.startDate} display={job.startDate ? formatDay(job.startDate) : undefined} type="date" onSave={save("startDate")} />
      <InlineField label="End" value={job.endDate} display={job.endDate ? formatDay(job.endDate) : undefined} type="date" onSave={save("endDate")} />
      <InlineField label="Call" value={job.callTime ? formatTime(job.callTime) : null} type="time" mono onSave={save("callTime")} />
      <InlineField label="Wrap" value={job.wrapTime ? formatTime(job.wrapTime) : null} type="time" mono onSave={save("wrapTime")} />
      <InlineField label="Time zone" value={job.timezone} onSave={save("timezone")} />

      <h2 className={h}>Where</h2>
      <InlineField label="Location" value={job.location} onSave={save("location")} />

      <h2 className={h}>Money</h2>
      <InlineField label="Day rate" value={job.dayRate} display={job.dayRate ? formatMoney(job.dayRate, job.currency) : undefined} type="number" mono onSave={save("dayRate")} />
      <InlineField label="Currency" value={job.currency} onSave={save("currency")} />
      <InlineField label="Usage" value={job.usage} multiline onSave={save("usage")} />
      <InlineField
        label="Invoice"
        value={invoice?.amount ?? null}
        display={invoice?.amount ? formatMoney(invoice.amount, invoice.currency ?? job.currency) : undefined}
        placeholder="Set amount"
        type="number"
        mono
        onSave={saveAmount}
      />
      <div className="flex items-center justify-between py-3">
        <span className="text-ink-3">Paid?</span>
        <span className={view === "overdue" ? "text-accent" : ""}>
          {view === null ? (job.status === "confirmed" || job.status === "wrapped" ? "To invoice" : "—") : INVOICE_LABEL[view]}
          {invoice?.dueAt && view === "invoiced" ? ` · due ${formatDay(invoice.dueAt.toISOString().slice(0, 10))}` : ""}
          {invoice?.paidAt && view === "paid" ? ` ${formatDay(invoice.paidAt.toISOString().slice(0, 10))}` : ""}
        </span>
      </div>
      {(job.status === "confirmed" || job.status === "wrapped" || invoice) && <InvoiceActions jobId={job.id} status={view} />}

      <h2 className={h}>Notes</h2>
      <InlineField label="Notes" value={job.notes} multiline placeholder="Add a note" onSave={save("notes")} />

      {travel.length > 0 && (
        <>
          <h2 className={h}>Travel</h2>
          <ul>
            {travel.map((t) => (
              <li key={t.id} className="py-3">
                <div className="capitalize">{t.kind}{t.from || t.to ? ` · ${[t.from, t.to].filter(Boolean).join(" → ")}` : ""}</div>
                <div className="text-sm text-ink-3">
                  {t.departAt ? t.departAt.toLocaleString("en-GB", { timeZone: job.timezone ?? "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  {t.reference ? ` · ${t.reference}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className={h}>Reminders</h2>
      {reminders.length ? (
        <ul>
          {reminders.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <span className={r.sentAt ? "text-ink-3" : ""}>{r.title}</span>
              <span className="num shrink-0 text-ink-3">
                {r.sentAt ? "sent" : r.sendAt.toLocaleString("en-GB", { timeZone: job.timezone ?? "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-ink-3">{job.status === "confirmed" ? "Nothing scheduled." : "Reminders start once the job is confirmed."}</p>
      )}

      <h2 className={h}>Source</h2>
      {source ? (
        <a href={gmailUrl(source.gmailId)} target="_blank" rel="noreferrer" className="block py-3 text-sm">
          <div className="truncate">{source.subject}</div>
          <div className="truncate text-ink-3">{source.from} · {formatDay(source.receivedAt.toISOString().slice(0, 10))} · open in Gmail ↗</div>
        </a>
      ) : (
        <p className="py-3 text-sm text-ink-3">Added by hand.</p>
      )}
    </article>
  );
}

const INVOICE_LABEL = { to_invoice: "To invoice", invoiced: "Invoiced", paid: "Paid", overdue: "Overdue" } as const;
