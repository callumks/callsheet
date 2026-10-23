// Captures the three screens at phone size, light and dark, from a running server.
// Usage: pnpm screenshots [baseUrl]   (default http://localhost:3000). Seed first: pnpm seed:demo --reset
import "./env";
import { SignJWT } from "jose";
import puppeteer from "puppeteer-core";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";

const base = process.argv[2] ?? "http://localhost:3000";
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
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await browser.setCookie({ name: "cs_session", value: token, domain: new URL(base).hostname, path: "/", httpOnly: true });

  const shots: [string, string][] = [["upcoming", "/"], ["job", `/jobs/${job?.id}`], ["earnings", "/earnings"], ["sign-in", "/sign-in"]];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    for (const [name, path] of shots) {
      await page.goto(base + path, { waitUntil: "networkidle0" });
      await page.screenshot({ path: `docs/screenshots/${name}-${scheme}.png`, fullPage: name === "job" });
    }
  }
  await browser.close();
  console.log("screenshots written to docs/screenshots");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
