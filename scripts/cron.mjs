// Railway cron entrypoint: `node scripts/cron.mjs sync|reminders`.
// Calls the app's cron route with the shared secret, logs the summary, exits.
const job = process.argv[2];
if (!["sync", "reminders"].includes(job)) {
  console.error("usage: node scripts/cron.mjs sync|reminders");
  process.exit(2);
}
const base = process.env.APP_URL;
const secret = process.env.CRON_SECRET;
if (!base || !secret) {
  console.error("APP_URL and CRON_SECRET must be set");
  process.exit(1);
}
const res = await fetch(new URL(`/api/cron/${job}`, base), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(280_000),
});
const body = await res.text();
console.log(`${job} ${res.status} ${body.slice(0, 2000)}`);
process.exit(res.ok ? 0 : 1);
