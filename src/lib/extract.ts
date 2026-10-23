// Step 4. One structured-output call per relevant email. Every field is
// nullable; the prompt says null beats a guess. The result is validated
// with Zod twice: once by the SDK against the strict schema, once here to
// normalise dates and numbers and to collect anything that needs review.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { EXTRACT_MODEL, anthropic, emailBlock } from "./llm";
import type { EmailLabel } from "./classify";

const nstr = z.string().nullable();

export const JobStatusSchema = z.enum(["option_1", "option_2", "confirmed", "cancelled", "wrapped"]);

export const ExtractedJobSchema = z.object({
  client: nstr.describe("Brand or end client the shoot is for"),
  agency: nstr.describe("The talent agency sending the booking"),
  booker: nstr.describe("Name of the booker or agent"),
  job_type: nstr.describe("e.g. e-commerce, campaign, lookbook, runway, fitting, casting"),
  status: JobStatusSchema.nullable(),
  start_date: nstr.describe("YYYY-MM-DD"),
  end_date: nstr.describe("YYYY-MM-DD; same as start_date for a one-day job"),
  call_time: nstr.describe("HH:MM 24h local"),
  wrap_time: nstr.describe("HH:MM 24h local"),
  location: nstr.describe("Studio or address as written"),
  timezone: nstr.describe("IANA zone for the location, e.g. Europe/London"),
  day_rate: z.number().nullable().describe("Rate per day, number only"),
  currency: nstr.describe("ISO 4217, e.g. GBP, USD, EUR"),
  usage: nstr.describe("Usage / buyout terms as written, including any separate fee"),
  notes: nstr.describe("Anything else a model needs on the day"),
});

export const ExtractedTravelSchema = z.object({
  kind: z.enum(["flight", "hotel", "car"]),
  from: nstr,
  to: nstr,
  depart_at: nstr.describe("ISO 8601 with offset, e.g. 2026-10-26T07:15:00+01:00"),
  arrive_at: nstr.describe("ISO 8601 with offset; for a hotel, check-out"),
  reference: nstr.describe("Booking reference / PNR"),
});

export const ExtractedPaymentSchema = z.object({
  amount: z.number().nullable(),
  currency: nstr,
  status: z.enum(["to_invoice", "invoiced", "paid"]).nullable(),
  sent_at: nstr.describe("YYYY-MM-DD the invoice was sent"),
  due_at: nstr.describe("YYYY-MM-DD"),
  paid_at: nstr.describe("YYYY-MM-DD"),
});

export const ExtractionSchema = z.object({
  job: ExtractedJobSchema.nullable(),
  travel: z.array(ExtractedTravelSchema),
  payment: ExtractedPaymentSchema.nullable(),
  changes: z.array(z.string()).describe("For updates: each change in words, e.g. 'call time 07:00 → 08:30'"),
  confidence: z.number().min(0).max(1),
  uncertain_fields: z.array(z.string()).describe("Field names you were not sure about or had to infer"),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const EXTRACT_SYSTEM = `You extract booking facts from emails sent to a freelance model/talent. Return only what the email states.

Rules
- A field you cannot read directly from the email is null. Never guess a date, time, rate or location.
- Dates are YYYY-MM-DD. Resolve weekday-only dates ("Monday") from the Received date, and list that field in uncertain_fields.
- Times are 24h HH:MM in the location's local time.
- day_rate is the fee per day. If the email gives a total for several days, divide only when the day count is explicit; otherwise put the total in notes and leave day_rate null. A usage or buyout fee is separate: describe it in usage, never add it to day_rate.
- currency is the ISO code. £ → GBP, $ → USD unless the email says otherwise, € → EUR.
- status: "option_1" for a first option/pencil/hold, "option_2" for a second, "confirmed" when booked, "cancelled" when cancelled or released. Null if unclear.
- timezone is the IANA zone of the location when the location makes it obvious (London → Europe/London, New York → America/New_York). Otherwise null.
- job is null when the email has no job in it (pure travel or payment mail). payment is null unless money is being invoiced, chased or paid.
- For an update email, fill job with the fields as they now stand and describe each change in changes.
- confidence is your overall confidence that the extraction is right, 0 to 1.`;

export async function extract(
  email: { from: string; subject: string; receivedAt: Date; text: string },
  label: EmailLabel,
): Promise<Extraction & { refusal?: string }> {
  const res = await anthropic().beta.messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionSchema) },
    system: [{ type: "text", text: EXTRACT_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `This email was classified as: ${label}\n\n${emailBlock(email)}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    return {
      job: null,
      travel: [],
      payment: null,
      changes: [],
      confidence: 0,
      uncertain_fields: [],
      refusal: res.stop_reason ?? "no-output",
    };
  }
  return normalise(res.parsed_output);
}

// --- Normalisation ---------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validDate(s: string | null): string | null {
  if (!s || !DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export function validTime(s: string | null): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const t = `${m[1].padStart(2, "0")}:${m[2]}`;
  return TIME_RE.test(t) ? t : null;
}

export function validInstant(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function validZone(s: string | null): string | null {
  if (!s) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: s });
    return s;
  } catch {
    return null;
  }
}

export function validCurrency(s: string | null): string | null {
  if (!s) return null;
  const c = s.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** Drops anything malformed to null and records it as uncertain. */
export function normalise(x: Extraction): Extraction {
  const uncertain = new Set(x.uncertain_fields);
  const check = <T>(field: string, raw: T, ok: T) => {
    if (raw !== null && raw !== undefined && ok === null) uncertain.add(field);
    return ok;
  };

  const job = x.job && {
    ...x.job,
    start_date: check("start_date", x.job.start_date, validDate(x.job.start_date)),
    end_date: check("end_date", x.job.end_date, validDate(x.job.end_date)),
    call_time: check("call_time", x.job.call_time, validTime(x.job.call_time)),
    wrap_time: check("wrap_time", x.job.wrap_time, validTime(x.job.wrap_time)),
    timezone: check("timezone", x.job.timezone, validZone(x.job.timezone)),
    currency: check("currency", x.job.currency, validCurrency(x.job.currency)),
    day_rate: x.job.day_rate !== null && x.job.day_rate >= 0 ? x.job.day_rate : check("day_rate", x.job.day_rate, null),
  };
  if (job && job.start_date && !job.end_date) job.end_date = job.start_date;
  if (job && job.start_date && job.end_date && job.end_date < job.start_date) {
    job.end_date = job.start_date;
    uncertain.add("end_date");
  }

  const travel = x.travel.map((t, i) => ({
    ...t,
    depart_at: check(`travel[${i}].depart_at`, t.depart_at, validInstant(t.depart_at)),
    arrive_at: check(`travel[${i}].arrive_at`, t.arrive_at, validInstant(t.arrive_at)),
  }));

  const payment = x.payment && {
    ...x.payment,
    currency: check("payment.currency", x.payment.currency, validCurrency(x.payment.currency)),
    sent_at: check("payment.sent_at", x.payment.sent_at, validDate(x.payment.sent_at)),
    due_at: check("payment.due_at", x.payment.due_at, validDate(x.payment.due_at)),
    paid_at: check("payment.paid_at", x.payment.paid_at, validDate(x.payment.paid_at)),
  };

  return { ...x, job, travel, payment, uncertain_fields: [...uncertain] };
}

/** The fields a job must have before it can run without review. */
export const REQUIRED_JOB_FIELDS = ["client", "start_date", "call_time", "location", "day_rate"] as const;

export function reviewReasons(x: Extraction, threshold = 0.7): string[] {
  const reasons: string[] = [];
  if (x.confidence < threshold) reasons.push(`low confidence (${x.confidence.toFixed(2)})`);
  if (x.job) {
    for (const f of REQUIRED_JOB_FIELDS) {
      if (x.job[f] === null) reasons.push(`${f} missing`);
    }
    if (!x.job.timezone) reasons.push("timezone missing");
  }
  for (const f of x.uncertain_fields) reasons.push(`${f} uncertain`);
  return [...new Set(reasons)];
}
