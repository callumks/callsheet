// Step 3. One cheap call that labels an email. Nothing is extracted here.

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CLASSIFY_MODEL, anthropic, emailBlock } from "./llm";

export const EmailLabel = z.enum(["new_booking", "update", "travel", "payment", "expense", "irrelevant"]);
export type EmailLabel = z.infer<typeof EmailLabel>;

export const ClassificationSchema = z.object({
  label: EmailLabel,
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const CLASSIFY_SYSTEM = `You label emails sent to a freelance model/talent about their work. Reply with one label.

new_booking  a job, option, pencil or hold being offered or confirmed for the first time in this thread
update       a change to a job already in play: option to confirmed, call time or location moved, cancelled, released, extra day
travel       flights, hotels, cars, itineraries for a job that someone else booked or paid for
payment      money owed TO the talent for their work: invoices they send, remittance, fees paid or chased
expense      a receipt or paid booking where the talent paid for work costs: flights, hotels, trains, taxis, kit
irrelevant   anything else: newsletters, castings with no booking, personal mail, receipts for unrelated purchases,
             and the talent's own bills and subscriptions (software, phone, loans, failed card payments)

If a mail both confirms a job and includes travel, choose new_booking or update; travel is only for mails that are mostly about travel.
A flight or hotel confirmation that shows a price charged to the talent is expense, not travel.
payment is only ever money coming in. A bill the talent has to pay is never payment.
confidence is how sure you are of the label, 0 to 1.`;

export async function classify(email: {
  from: string;
  subject: string;
  receivedAt: Date;
  text: string;
}): Promise<Classification> {
  const res = await anthropic().messages.parse({
    model: CLASSIFY_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(ClassificationSchema) },
    system: [{ type: "text", text: CLASSIFY_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: emailBlock(email, 6_000) }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    return { label: "irrelevant", confidence: 0, reason: `no classification (${res.stop_reason})` };
  }
  return res.parsed_output;
}
