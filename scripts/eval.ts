// Fixture eval for the classify + extract steps.
//   pnpm tsx scripts/eval.ts [--only NNN] [--skip-llm]

import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { EmailLabel } from "../src/lib/classify";
import { ExtractionSchema, REQUIRED_JOB_FIELDS, type Extraction } from "../src/lib/extract";

config({ path: ".env.local" });
config();

export const FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));

export type Fixture = {
  id: string;
  name: string;
  from: string;
  subject: string;
  receivedAt: Date;
  threadId: string;
  text: string;
};

export const ExpectedSchema = z.object({
  label: EmailLabel,
  extraction: ExtractionSchema.nullable(),
});
export type Expected = z.infer<typeof ExpectedSchema>;

/** Four header lines, blank line, body. Throws on anything else. */
export function parseFixture(raw: string, name = "fixture"): Fixture {
  const text = raw.replace(/\r\n/g, "\n");
  const split = text.indexOf("\n\n");
  if (split === -1) throw new Error(`${name}: no blank line after headers`);
  const headers: Record<string, string> = {};
  for (const line of text.slice(0, split).split("\n")) {
    const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (!m) throw new Error(`${name}: bad header line "${line}"`);
    headers[m[1].toLowerCase()] = m[2].trim();
  }
  for (const h of ["from", "subject", "date", "thread"]) {
    if (!headers[h]) throw new Error(`${name}: missing ${h} header`);
  }
  const receivedAt = new Date(headers.date);
  if (Number.isNaN(receivedAt.getTime())) throw new Error(`${name}: bad Date "${headers.date}"`);
  const id = name.match(/^(\d{3})/)?.[1] ?? name;
  return {
    id,
    name,
    from: headers.from,
    subject: headers.subject,
    receivedAt,
    threadId: headers.thread,
    text: text.slice(split + 2).trim(),
  };
}

export function loadFixtures(dir = FIXTURES_DIR, only?: string): { fixture: Fixture; expected: Expected }[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort();
  const out: { fixture: Fixture; expected: Expected }[] = [];
  for (const f of files) {
    const name = basename(f, ".txt");
    if (only && !name.startsWith(only)) continue;
    const fixture = parseFixture(readFileSync(join(dir, f), "utf8"), name);
    const expectedPath = join(dir, `${name}.expected.json`);
    const expected = ExpectedSchema.parse(JSON.parse(readFileSync(expectedPath, "utf8")));
    if (expected.label !== "irrelevant" && !expected.extraction) {
      throw new Error(`${name}: ${expected.label} needs an extraction`);
    }
    out.push({ fixture, expected });
  }
  return out;
}

// --- Scoring ---------------------------------------------------------------

type Mismatch = { id: string; field: string; expected: unknown; got: unknown };

const JOB_FIELDS = [
  "client", "agency", "booker", "job_type", "status", "start_date", "end_date", "call_time",
  "wrap_time", "location", "timezone", "day_rate", "currency", "usage", "notes",
] as const;
const TRAVEL_FIELDS = ["kind", "reference", "depart_at", "arrive_at"] as const;
const PAYMENT_FIELDS = ["amount", "currency", "status", "sent_at", "due_at", "paid_at"] as const;

// Free-text fields: a looser match so wording differences don't fail the run.
const FUZZY = new Set(["client", "agency", "booker", "job_type", "location", "usage", "notes", "from", "to"]);
const LOOSE = new Set(["usage", "notes"]);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function fieldMatches(field: string, expected: unknown, got: unknown): boolean {
  if (expected === null || expected === undefined) return got === null || got === undefined;
  if (got === null || got === undefined) return false;
  if (typeof expected === "number" && typeof got === "number") return Math.abs(expected - got) < 0.005;
  if (typeof expected === "string" && typeof got === "string") {
    if (!FUZZY.has(field)) return expected === got;
    const a = norm(expected);
    const b = norm(got);
    if (a === b || a.includes(b) || b.includes(a)) return true;
    if (!LOOSE.has(field)) return false;
    // notes/usage are prose: accept if either contains the other's first few words
    const head = (s: string) => s.split(" ").slice(0, 4).join(" ");
    return a.includes(head(b)) || b.includes(head(a));
  }
  return expected === got;
}

export class Scorer {
  labels = { correct: 0, total: 0 };
  fields = new Map<string, { correct: number; total: number }>();
  mismatches: Mismatch[] = [];

  private tally(field: string, ok: boolean) {
    const f = this.fields.get(field) ?? { correct: 0, total: 0 };
    f.total += 1;
    if (ok) f.correct += 1;
    this.fields.set(field, f);
  }

  label(id: string, expected: EmailLabel, got: EmailLabel) {
    this.labels.total += 1;
    if (expected === got) this.labels.correct += 1;
    else this.mismatches.push({ id, field: "label", expected, got });
  }

  extraction(id: string, expected: Extraction, got: Extraction) {
    const check = (field: string, e: unknown, g: unknown) => {
      const ok = fieldMatches(field.replace(/^.*\./, "").replace(/\[\d+\]/, ""), e, g);
      this.tally(field, ok);
      if (!ok) this.mismatches.push({ id, field, expected: e, got: g });
    };

    this.tally("job.present", (expected.job === null) === (got.job === null));
    if (expected.job && got.job) {
      for (const f of JOB_FIELDS) check(`job.${f}`, expected.job[f], got.job[f]);
    } else if (expected.job && !got.job) {
      for (const f of JOB_FIELDS) check(`job.${f}`, expected.job[f], null);
    } else if (!expected.job && got.job) {
      this.mismatches.push({ id, field: "job", expected: null, got: "job present" });
    }

    this.tally("travel.count", expected.travel.length === got.travel.length);
    if (expected.travel.length !== got.travel.length) {
      this.mismatches.push({ id, field: "travel.count", expected: expected.travel.length, got: got.travel.length });
    }
    expected.travel.forEach((t, i) => {
      const g = got.travel[i];
      for (const f of TRAVEL_FIELDS) check(`travel.${f}`, t[f], g ? g[f] : null);
    });

    this.tally("payment.present", (expected.payment === null) === (got.payment === null));
    if (expected.payment) {
      for (const f of PAYMENT_FIELDS) check(`payment.${f}`, expected.payment[f], got.payment ? got.payment[f] : null);
    } else if (got.payment) {
      this.mismatches.push({ id, field: "payment", expected: null, got: "payment present" });
    }
  }

  accuracy(field: string): number | null {
    const f = this.fields.get(field);
    return f && f.total ? f.correct / f.total : null;
  }

  failed(): string[] {
    const reasons: string[] = [];
    const la = this.labels.total ? this.labels.correct / this.labels.total : 1;
    if (la < 0.9) reasons.push(`label accuracy ${la.toFixed(2)} < 0.90`);
    for (const f of REQUIRED_JOB_FIELDS) {
      const a = this.accuracy(`job.${f}`);
      if (a !== null && a < 0.9) reasons.push(`job.${f} accuracy ${a.toFixed(2)} < 0.90`);
    }
    return reasons;
  }
}

// --- Main ------------------------------------------------------------------

const PRICE = {
  classify: { in: 0.1, out: 0.5 }, // $/MTok, Haiku 5.5
  extract: { in: 4, out: 20 }, // $/MTok, Opus 5.5
};

async function main() {
  const args = process.argv.slice(2);
  const skipLlm = args.includes("--skip-llm");
  const onlyIx = args.indexOf("--only");
  const only = onlyIx >= 0 ? args[onlyIx + 1] : undefined;

  const set = loadFixtures(FIXTURES_DIR, only);
  console.log(`${set.length} fixture${set.length === 1 ? "" : "s"} loaded from fixtures/`);

  if (skipLlm) {
    for (const { fixture, expected } of set) {
      console.log(`  ok  ${fixture.name}  (${expected.label}, ${fixture.text.length} chars)`);
    }
    console.log("\nOffline check passed: every pair parses and every expected.json matches ExtractionSchema.");
    return;
  }

  const { classify } = await import("../src/lib/classify");
  const { extract } = await import("../src/lib/extract");

  const scorer = new Scorer();
  // classify()/extract() don't expose usage, so tokens are estimated at chars/4.
  const est = { classify: { in: 0, out: 0 }, extract: { in: 0, out: 0 } };
  const notes: string[] = [];

  for (const { fixture, expected } of set) {
    const email = { from: fixture.from, subject: fixture.subject, receivedAt: fixture.receivedAt, text: fixture.text };
    const started = Date.now();
    const c = await classify(email);
    est.classify.in += Math.ceil((email.text.slice(0, 6000).length + 900) / 4);
    est.classify.out += 60;
    scorer.label(fixture.id, expected.label, c.label);
    let line = `  ${fixture.id}  label ${c.label === expected.label ? "✓" : "✗"} ${c.label.padEnd(12)} conf ${c.confidence.toFixed(2)}`;

    if (expected.label !== "irrelevant" && expected.extraction) {
      const x = await extract(email, expected.label);
      est.extract.in += Math.ceil((email.text.slice(0, 12000).length + 1600) / 4);
      est.extract.out += 400;
      if (x.refusal) notes.push(`${fixture.id}: extract refused (${x.refusal})`);
      const before = scorer.mismatches.length;
      scorer.extraction(fixture.id, expected.extraction, x);
      const bad = scorer.mismatches.length - before;
      line += `  extract ${bad === 0 ? "✓" : `✗ ${bad}`}  conf ${x.confidence.toFixed(2)}`;
      if (x.uncertain_fields.length) line += `  uncertain: ${x.uncertain_fields.join(", ")}`;
      if (x.changes.length) notes.push(`${fixture.id} changes: ${x.changes.join(" | ")}`);
    }
    console.log(`${line}  ${Date.now() - started}ms`);
  }

  console.log("\nLabel accuracy:", `${scorer.labels.correct}/${scorer.labels.total}`);
  console.log("\nField accuracy:");
  const rows = [...scorer.fields.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [field, { correct, total }] of rows) {
    const req = REQUIRED_JOB_FIELDS.some((f) => field === `job.${f}`) ? " *" : "";
    console.log(`  ${field.padEnd(20)} ${String(correct).padStart(3)}/${String(total).padEnd(3)} ${((correct / total) * 100).toFixed(0).padStart(4)}%${req}`);
  }
  console.log("  * required job field, must stay ≥ 90%");

  if (scorer.mismatches.length) {
    console.log("\nMismatches:");
    for (const m of scorer.mismatches) {
      console.log(`  ${m.id}  ${m.field.padEnd(18)} expected ${JSON.stringify(m.expected)}  got ${JSON.stringify(m.got)}`);
    }
  }
  if (notes.length) {
    console.log("\nNotes (not scored):");
    for (const n of notes) console.log(`  ${n}`);
  }

  const cost =
    (est.classify.in * PRICE.classify.in + est.classify.out * PRICE.classify.out +
      est.extract.in * PRICE.extract.in + est.extract.out * PRICE.extract.out) / 1e6;
  console.log(
    `\nTokens (estimated, chars/4; SDK usage not exposed by classify/extract): classify ${est.classify.in}+${est.classify.out}, extract ${est.extract.in}+${est.extract.out}`,
  );
  console.log(`Estimated cost: $${cost.toFixed(4)} for ${set.length} emails ($${(cost / set.length).toFixed(4)}/email)`);

  const failed = scorer.failed();
  if (failed.length) {
    console.error(`\nFAIL: ${failed.join("; ")}`);
    process.exit(1);
  }
  console.log("\nPASS");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
