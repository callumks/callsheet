import type { Metadata } from "next";
import Link from "next/link";

// Signed-out visitors to "/" see this page (the proxy rewrites them here).

export const metadata: Metadata = {
  title: { absolute: "Callsheet · Bookings read straight from the inbox" },
  description: "A personal app that reads model bookings from Gmail and turns them into jobs, call-time reminders and an earnings view.",
};

const REPO = "https://github.com/callumks/callsheet";

const SCREENS = [
  { name: "upcoming", label: "Upcoming", alt: "Upcoming: the next job as a hero card, then the next two weeks" },
  { name: "job", label: "Job", alt: "Job detail: every field tap-to-edit" },
  { name: "earnings", label: "Earnings", alt: "Earnings: month total, paid and unpaid split, six months of bars" },
];

const STEPS = [
  { title: "Pull", body: "Every 15 minutes a cron asks Gmail, read-only, for anything new since the last run." },
  { title: "Sort", body: "Claude Haiku labels each email: new booking, update, travel, payment, expense or irrelevant. Irrelevant stops here." },
  { title: "Extract", body: "Claude Opus fills a strict schema: dates, call time, location, rate, who paid. Anything unstated stays empty." },
  { title: "File", body: "The result updates the matching job or creates one, then schedules push reminders in the job's time zone." },
];

const PRINCIPLES = [
  { title: "Null beats a guess", body: "Missing fields stay empty and the job is flagged for a quick check, instead of inventing a call time." },
  { title: "Updates edit, they don't duplicate", body: "A moved call time changes the existing job and sends a push saying what changed." },
  { title: "Email bodies are never stored", body: "Each body lives only for the length of one run. Only headers and extracted fields are kept." },
  { title: "Failures retry", body: "An email that errors is tried again on the next run, up to five times, so a bad minute doesn't lose a booking." },
];

const STACK = ["Next.js 16", "TypeScript", "Tailwind", "Postgres + Drizzle", "Claude Haiku + Opus", "Gmail API", "Web push", "Railway"];

function Dots({ size = "h-3 w-3" }: { size?: string }) {
  return (
    <span className="flex gap-1" aria-hidden>
      <span className={`dot dot-confirmed ${size}`} />
      <span className={`dot dot-option_1 ${size}`} />
      <span className={`dot dot-option_2 ${size}`} />
    </span>
  );
}

function Phone({ name, alt, className = "" }: { name: string; alt: string; className?: string }) {
  return (
    <picture className={`block overflow-hidden rounded-[2rem] bg-surface ring-1 ring-hairline shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] ${className}`}>
      <source media="(prefers-color-scheme: dark)" srcSet={`/screens/${name}-dark.png`} />
      <img src={`/screens/${name}-light.png`} alt={alt} width={780} height={1688} className="block h-auto w-full" loading="lazy" />
    </picture>
  );
}

export default function WelcomePage() {
  return (
    <div className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-[-0.02em]">
          <Dots size="h-2.5 w-2.5" />
          Callsheet
        </Link>
        <nav className="flex items-center gap-5 text-sm text-ink-2">
          <a href={REPO} className="hover:text-ink">GitHub</a>
          <Link href="/sign-in" className="hover:text-ink">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="rise mx-auto max-w-5xl px-6 pb-16 pt-20 sm:pt-28">
          <p className="label">A personal app, built by a working model</p>
          <h1 className="mt-4 max-w-3xl text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[4rem]">
            Bookings, call times and what I&rsquo;m owed, read straight from my inbox.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Jobs, options, travel and payments all arrive by email, and I never logged any of it. Callsheet reads those emails, turns each job
            into a record, reminds me the night before I&rsquo;m on set, and shows what&rsquo;s still unpaid.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={REPO} className="press inline-flex h-12 items-center rounded-full bg-ink px-6 text-[0.95rem] font-medium text-ground">
              Read the code
            </a>
            <a href="#how" className="press inline-flex h-12 items-center rounded-full bg-surface px-6 text-[0.95rem] font-medium">
              How it works
            </a>
          </div>
        </section>

        <section aria-label="Screens" className="mx-auto max-w-5xl">
          <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-6 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible">
            {SCREENS.map((s, i) => (
              <figure key={s.name} className={`w-[72%] shrink-0 snap-center sm:w-auto ${i === 1 ? "sm:-translate-y-6" : ""}`}>
                <Phone name={s.name} alt={s.alt} />
                <figcaption className="label mt-3 text-center">{s.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-24">
          <p className="label">One email in, one job out</p>
          <div className="mt-6 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-8">
            <div className="rounded-3xl bg-surface p-6 text-[0.95rem] leading-relaxed">
              <div className="text-sm text-ink-3">From: bookings@northagency.example</div>
              <div className="mt-1 font-medium">Confirmed: Northbound, Sun 25 Oct</div>
              <p className="mt-4 text-ink-2">
                Hi! You&rsquo;re confirmed for Northbound this Sunday. Call is 7am at Studio Halden, Hackney Wick. Day rate £1,200 as discussed,
                usage 12 months UK. Wardrobe will be in touch&nbsp;x
              </p>
            </div>
            <div className="flex justify-center text-ink-3" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-90 md:rotate-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <div className="rounded-3xl bg-surface p-6">
              <div className="flex items-center gap-2 text-ink-2">
                <span className="dot dot-confirmed" /> Confirmed
              </div>
              <div className="mt-4 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em]">Northbound</div>
              <div className="text-ink-2">Sun 25 Oct · North Agency</div>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="label">Call</dt>
                  <dd className="num-display mt-1 text-[2.5rem] font-semibold leading-none">07:00</dd>
                </div>
                <div>
                  <dt className="label">Day rate</dt>
                  <dd className="num mt-3 text-xl text-ink-2">£1,200</dd>
                </div>
              </dl>
              <div className="mt-5 text-ink-2">Studio Halden, Hackney Wick</div>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-8 border-t border-hairline">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <h2 className="text-[2rem] font-semibold tracking-[-0.03em]">How it works</h2>
            <ol className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <div className="num text-sm text-accent">0{i + 1}</div>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.015em]">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-hairline">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <h2 className="text-[2rem] font-semibold tracking-[-0.03em]">Rules it keeps</h2>
            <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.title}>
                  <h3 className="text-lg font-semibold tracking-[-0.015em]">{p.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-hairline">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <h2 className="text-[2rem] font-semibold tracking-[-0.03em]">Built with</h2>
            <ul className="mt-8 flex flex-wrap gap-2">
              {STACK.map((t) => (
                <li key={t} className="rounded-full bg-surface px-4 py-2 text-sm">
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-xl leading-relaxed text-ink-2">
              It&rsquo;s a personal tool, so sign-in is limited to my own Google account. The full source, the original spec and a fixture-based
              eval for the extraction prompts are on GitHub.
            </p>
            <a href={REPO} className="press mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 text-[0.95rem] font-medium text-ground">
              Read the code
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-sm text-ink-3">
          <span className="flex items-center gap-2.5">
            <Dots size="h-2 w-2" />
            Callsheet
          </span>
          <nav className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <a href={REPO} className="hover:text-ink">GitHub</a>
            <Link href="/sign-in" className="hover:text-ink">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
