// Captures the three screens at phone size, light and dark, from a running server.
// Usage: pnpm screenshots [baseUrl]   (default http://localhost:3000). Seed first: pnpm seed:demo --reset
import "./env";
import { SignJWT } from "jose";
import puppeteer from "puppeteer-core";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = process.env.SHOTS_DIR ?? "docs/screens";
const full = process.env.SHOTS_FULL === "1";
const width = Number(process.env.SHOTS_WIDTH ?? 390);
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(process.env.ALLOWED_EMAIL!)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.client, "Meridian Eyewear")).limit(1);

  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await browser.setCookie({ name: "cs_session", value: token, domain: new URL(base).hostname, path: "/", httpOnly: true });

  const shots: [string, string][] = [["upcoming", "/"], ["job", `/jobs/${job?.id}`], ["earnings", "/earnings"], ...(process.env.SHOTS_ALL === "1" ? ([["review", "/review"], ["missing", "/jobs/nope"]] as [string, string][]) : [])];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    for (const [name, path] of shots) {
      await page.goto(base + path, { waitUntil: "networkidle0" });
      await page.screenshot({ path: `${outDir}/${name}-${scheme}.png`, fullPage: full });
    }
  }
  if (process.env.SHOTS_ALL === "1") {
    const anon = await browser.createBrowserContext();
    const p2 = await anon.newPage();
    await p2.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const scheme of ["light", "dark"] as const) {
      await p2.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      await p2.goto(base + "/sign-in", { waitUntil: "networkidle0" });
      await p2.screenshot({ path: `${outDir}/sign-in-${scheme}.png` });
    }
  }
  await browser.close();
  console.log(`screenshots written to ${outDir}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
