// One-off backfill: re-reads the inbox window instead of the Gmail history pointer.
// Usage: pnpm tsx scripts/backfill.ts [days=365]
// Safe to re-run: emails already processed are skipped, so a crash just means run it again.
import "./env";

import { runSync } from "../src/lib/pipeline";
import { listNewMessageIds } from "../src/lib/gmail";

async function main() {
  const days = Number(process.argv[2] ?? 365);
  if (!Number.isFinite(days) || days < 1) {
    console.error("usage: pnpm tsx scripts/backfill.ts [days]");
    process.exit(2);
  }

  console.log(`Backfilling the last ${days} days against ${process.env.DATABASE_URL?.replace(/\/\/[^@]*@/, "//***@")}`);
  const out = await runSync({
    listNewMessageIds: (token) => listNewMessageIds(token, null, { fallbackDays: days }),
  });
  for (const s of out) {
    const { errors, ...rest } = s;
    console.log(JSON.stringify(rest, null, 2));
    if (errors.length) console.log(`${errors.length} errors, first few:`, errors.slice(0, 5));
  }
  if (!out.length) console.log("No connected Google account found (or it needs reconnecting).");
  process.exit(0);
}

main();
