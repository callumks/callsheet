import { format, parseISO } from "date-fns";

/** "2026-10-27" → "Mon 27 Oct" */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "Date TBC";
  return format(parseISO(iso), "EEE d MMM");
}

/** "2026-10-27".."2026-10-29" → "Mon 27 – Wed 29 Oct" */
export function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "Date TBC";
  if (!end || end === start) return formatDay(start);
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.getMonth() === e.getMonth()) return `${format(s, "EEE d")} – ${format(e, "EEE d MMM")}`;
  return `${format(s, "EEE d MMM")} – ${format(e, "EEE d MMM")}`;
}

/** "07:00:00" or "07:00" → "07:00" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "TBC";
  return t.slice(0, 5);
}

export function formatMoney(amount: string | number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency ?? "GBP",
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  } catch {
    return `${n} ${currency ?? ""}`.trim();
  }
}

export function jobName(job: { client: string | null; agency: string | null }): string {
  return job.client ?? job.agency ?? "Job";
}

export const STATUS_LABEL: Record<string, string> = {
  option_1: "1st option",
  option_2: "2nd option",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  wrapped: "Wrapped",
};

/** Inclusive list of YYYY-MM-DD between two dates. */
export function eachDay(start: string, end: string | null): string[] {
  const out: string[] = [];
  const s = parseISO(start);
  const e = parseISO(end ?? start);
  for (let d = s; d <= e && out.length < 60; d = new Date(d.getTime() + 86_400_000)) {
    out.push(format(d, "yyyy-MM-dd"));
  }
  return out;
}
