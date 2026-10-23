// Step 2 of the pipeline. Decides from headers alone whether an email is
// worth reading. Anything that fails here is never fetched past the headers.

export const BOOKING_WORDS = [
  "confirmed",
  "confirmation",
  "option",
  "pencil",
  "hold",
  "booking",
  "booked",
  "call sheet",
  "callsheet",
  "call time",
  "flight",
  "itinerary",
  "hotel",
  "travel",
  "schedule",
  "shoot",
  "fitting",
  "casting",
  "job",
  "invoice",
  "remittance",
  "payment",
  "paid",
  "cancelled",
  "canceled",
  "released",
] as const;

const WORD_RE = new RegExp(`\\b(${BOOKING_WORDS.map((w) => w.replace(/ /g, "\\s*")).join("|")})\\b`, "i");

export function agencyDomains(): string[] {
  return (process.env.AGENCY_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** `"Jo Booker <jo@agency.com>"` → `agency.com` */
export function senderDomain(from: string): string | null {
  const m = from.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return m ? m[1].toLowerCase() : null;
}

export function isAgencyDomain(from: string, domains = agencyDomains()): boolean {
  const d = senderDomain(from);
  if (!d) return false;
  return domains.some((a) => d === a || d.endsWith(`.${a}`));
}

export function hasBookingWords(subject: string): boolean {
  return WORD_RE.test(subject);
}

export type FilterResult = { keep: true; reason: "agency" | "subject" } | { keep: false; reason: "no-match" };

export function shouldProcess(
  msg: { from: string; subject: string },
  domains = agencyDomains(),
): FilterResult {
  if (isAgencyDomain(msg.from, domains)) return { keep: true, reason: "agency" };
  if (hasBookingWords(msg.subject)) return { keep: true, reason: "subject" };
  return { keep: false, reason: "no-match" };
}
