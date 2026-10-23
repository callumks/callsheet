import { notFound } from "next/navigation";
import { Group, Row } from "@/components/group";
import { BedIcon, BellIcon, CarIcon, MailIcon, PinIcon, PlaneIcon } from "@/components/icons";
import { BackBar } from "@/components/page-header";
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

const INVOICE_LABEL = { to_invoice: "To invoice", invoiced: "Invoiced", paid: "Paid", overdue: "Overdue" } as const;
const REMINDER_LABEL: Record<string, string> = {
  night_before: "Night before",
  call_time: "Before call",
  invoice_due: "Invoice nudge",
  overdue: "Overdue nudge",
  new_booking: "New booking",
  job_changed: "Job changed",
};
const TRAVEL_ICON = { flight: PlaneIcon, hotel: BedIcon, car: CarIcon } as const;

function when(d: Date, tz: string | null) {
  return d.toLocaleString("en-GB", { timeZone: tz ?? "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function short(d: Date, tz: string | null) {
  const z = { timeZone: tz ?? "UTC" } as const;
  const day = d.toLocaleDateString("en-GB", { ...z, weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { ...z, hour: "2-digit", minute: "2-digit" });
  return (
    <>
      {day} <span className="num text-ink-2">{time}</span>
    </>
  );
}

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const d = await jobDetail(id);
  if (!d) notFound();
  const { job, travel, invoice, reminders, source } = d;
  const view = invoiceView(invoice);
  const billable = job.status === "confirmed" || job.status === "wrapped" || !!invoice;

  const save = (field: EditableField) => async (raw: string) => {
    "use server";
    return updateJobField(job.id, field, raw);
  };
  const saveAmount = async (raw: string) => {
    "use server";
    return setInvoiceAmount(job.id, raw);
  };
  const statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
  const maps = job.location ? `https://maps.apple.com/?q=${encodeURIComponent(job.location)}` : null;
  const upcomingReminders = reminders.filter((r) => !r.sentAt);

  return (
    <article>
      <BackBar href="/" label="Upcoming" />

      <header className="rise mt-2">
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <StatusDot status={job.status} />
          {STATUS_LABEL[job.status]}
          {job.agency && <span className="text-ink-3">· {job.agency}</span>}
        </div>
        <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.03em]">{jobName(job)}</h1>
        <p className="mt-0.5 text-[1.05rem] text-ink-2">{formatRange(job.startDate, job.endDate)}</p>
      </header>

      {job.needsReview && <ReviewBanner jobId={job.id} reason={job.reviewReason} />}

      <div className="rise mt-6 rounded-[1.5rem] bg-surface p-5">
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Call", job.callTime ? formatTime(job.callTime) : "TBC"],
            ["Wrap", job.wrapTime ? formatTime(job.wrapTime) : "—"],
            ["Day rate", job.dayRate ? formatMoney(job.dayRate, job.currency) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <div className="label">{k}</div>
              <div className="num mt-1 truncate text-xl font-medium">{v}</div>
            </div>
          ))}
        </div>
        {job.location && (
          <a href={maps!} target="_blank" rel="noreferrer" className="press mt-5 flex items-start gap-2.5 rounded-xl bg-ground px-3 py-3">
            <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 text-[0.95rem]">{job.location}</span>
            <span className="shrink-0 text-xs text-ink-3">Maps</span>
          </a>
        )}
      </div>

      {billable && (
        <section className="mt-3 rounded-[1.5rem] bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="label">Invoice</div>
              <div className="num mt-1 text-2xl font-medium">{invoice?.amount ? formatMoney(invoice.amount, invoice.currency ?? job.currency) : "—"}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                view === "overdue" ? "bg-accent-soft text-accent" : view === "paid" ? "bg-ink text-ground" : "bg-ground text-ink-2"
              }`}
            >
              {view ? INVOICE_LABEL[view] : "To invoice"}
            </span>
          </div>
          {(invoice?.dueAt || invoice?.paidAt) && (
            <p className="mt-1 text-sm text-ink-3">
              {view === "paid" && invoice.paidAt ? `Paid ${formatDay(invoice.paidAt.toISOString().slice(0, 10))}` : invoice.dueAt ? `Due ${formatDay(invoice.dueAt.toISOString().slice(0, 10))}` : ""}
            </p>
          )}
          <InvoiceActions jobId={job.id} status={view} />
        </section>
      )}

      {travel.length > 0 && (
        <Group title="Travel">
          {travel.map((t) => {
            const Icon = TRAVEL_ICON[t.kind];
            return (
              <Row key={t.id}>
                <Icon className="h-[1.1rem] w-[1.1rem] shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.kind === "hotel" ? (t.to ?? "Hotel") : [t.from, t.to].filter(Boolean).join(" → ") || t.kind}</div>
                  {t.departAt && <div className="text-sm text-ink-3">{when(t.departAt, job.timezone)}</div>}
                </div>
                {t.reference && <span className="num shrink-0 text-sm text-ink-2">{t.reference}</span>}
              </Row>
            );
          })}
        </Group>
      )}

      <Group title="Details">
        <InlineField label="Status" value={job.status} display={STATUS_LABEL[job.status]} type="select" options={statusOptions} onSave={save("status")} />
        <InlineField label="Client" value={job.client} onSave={save("client")} />
        <InlineField label="Agency" value={job.agency} onSave={save("agency")} />
        <InlineField label="Booker" value={job.booker} onSave={save("booker")} />
        <InlineField label="Type" value={job.jobType} onSave={save("jobType")} />
      </Group>

      <Group>
        <InlineField label="Start" value={job.startDate} display={job.startDate ? formatDay(job.startDate) : undefined} type="date" onSave={save("startDate")} />
        <InlineField label="End" value={job.endDate} display={job.endDate ? formatDay(job.endDate) : undefined} type="date" onSave={save("endDate")} />
        <InlineField label="Call" value={job.callTime ? formatTime(job.callTime) : null} type="time" mono onSave={save("callTime")} />
        <InlineField label="Wrap" value={job.wrapTime ? formatTime(job.wrapTime) : null} type="time" mono onSave={save("wrapTime")} />
        <InlineField label="Location" value={job.location} onSave={save("location")} />
        <InlineField label="Time zone" value={job.timezone} onSave={save("timezone")} />
      </Group>

      <Group footer="Tap any value to edit it.">
        <InlineField label="Day rate" value={job.dayRate} display={job.dayRate ? formatMoney(job.dayRate, job.currency) : undefined} type="number" mono onSave={save("dayRate")} />
        <InlineField label="Currency" value={job.currency} onSave={save("currency")} />
        <InlineField label="Invoice total" value={invoice?.amount ?? null} display={invoice?.amount ? formatMoney(invoice.amount, invoice.currency ?? job.currency) : undefined} type="number" mono onSave={saveAmount} />
        <InlineField label="Usage" value={job.usage} multiline onSave={save("usage")} />
        <InlineField label="Notes" value={job.notes} multiline placeholder="Add a note" onSave={save("notes")} />
      </Group>

      <Group title="Reminders">
        {upcomingReminders.length ? (
          upcomingReminders.map((r) => (
            <Row key={r.id}>
              <BellIcon className="h-4 w-4 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate">{REMINDER_LABEL[r.kind] ?? r.title}</span>
              <span className="shrink-0 text-sm text-ink-3">{short(r.sendAt, job.timezone)}</span>
            </Row>
          ))
        ) : (
          <Row>
            <span className="text-ink-3">{job.status === "confirmed" ? "Nothing scheduled." : "Reminders start once the job is confirmed."}</span>
          </Row>
        )}
      </Group>

      <Group title="Source">
        {source ? (
          <a href={gmailUrl(source.gmailId)} target="_blank" rel="noreferrer" className="press flex items-center gap-3 px-4 py-3.5">
            <MailIcon className="h-4 w-4 shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{source.subject}</div>
              <div className="truncate text-sm text-ink-3">{source.from.replace(/<.*>/, "").trim()} · {formatDay(source.receivedAt.toISOString().slice(0, 10))}</div>
            </div>
            <span className="shrink-0 text-xs text-ink-3">Gmail</span>
          </a>
        ) : (
          <Row>
            <span className="text-ink-3">Added by hand.</span>
          </Row>
        )}
      </Group>
    </article>
  );
}
