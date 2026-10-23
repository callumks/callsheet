import Anthropic from "@anthropic-ai/sdk";

// Classify is the cheap call; extract is the careful one. Both overridable
// so the fixture eval can price models against each other.
export const CLASSIFY_MODEL = process.env.CLASSIFY_MODEL ?? "claude-haiku-5-5";
export const EXTRACT_MODEL = process.env.EXTRACT_MODEL ?? "claude-opus-5-5";

let client: Anthropic | undefined;
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 3, timeout: 120_000 });
  return client;
}

/** Bodies can be huge (quoted threads, signatures). Keep the head; it carries the booking. */
export function clip(text: string, max = 12_000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[… ${text.length - max} more characters trimmed]`;
}

export function emailBlock(e: { from: string; subject: string; receivedAt: Date; text: string }, max?: number): string {
  return [
    `From: ${e.from}`,
    `Subject: ${e.subject}`,
    `Received: ${e.receivedAt.toISOString()}`,
    "",
    clip(e.text, max),
  ].join("\n");
}
