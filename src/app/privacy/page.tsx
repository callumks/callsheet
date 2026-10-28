import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

const REPO = "https://github.com/callumks/callsheet";
const UPDATED = "28 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-[-0.015em]">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm text-ink-3 hover:text-ink">
        ← Callsheet
      </Link>
      <h1 className="mt-10 text-[2.25rem] font-semibold leading-tight tracking-[-0.035em]">Privacy</h1>
      <p className="mt-2 text-sm text-ink-3">Last updated {UPDATED}</p>

      <Section title="Who can use it">
        <p>
          Callsheet is a personal app. Sign-in is restricted to a single allow-listed Google account, and nobody else&rsquo;s data is collected.
        </p>
      </Section>

      <Section title="What it reads from Google">
        <p>
          Callsheet asks for your email address and read-only access to Gmail (the <code className="num">gmail.readonly</code> scope). It cannot send,
          delete, label or change any email.
        </p>
        <p>
          Every 15 minutes it fetches messages that arrived since the last run. It reads the headers to skip obvious noise, and reads the body of the
          rest to find bookings, updates, travel, payments and expenses.
        </p>
      </Section>

      <Section title="Where email content goes">
        <p>
          The body of a relevant email is sent to Anthropic&rsquo;s Claude API to classify it and pull out structured fields such as date, call time,
          location, rate and amounts. Anthropic processes it under its commercial API terms and does not use API data to train models.
        </p>
        <p>Email bodies are never written to Callsheet&rsquo;s database. They exist only in memory for the length of one sync.</p>
      </Section>

      <Section title="What is stored">
        <ul className="list-disc space-y-2 pl-5">
          <li>For each processed email: the Gmail message and thread IDs, sender, subject, received time and how it was classified.</li>
          <li>The jobs, travel, invoices, expenses and reminders extracted from those emails, plus any edits made in the app.</li>
          <li>The Google refresh token, encrypted with AES before it is saved.</li>
          <li>Web push subscriptions for the devices that receive reminders.</li>
        </ul>
        <p>Everything is held in a Postgres database hosted on Railway. Nothing is sold, shared or used for advertising.</p>
      </Section>

      <Section title="Removing access and data">
        <p>
          Access can be revoked at any time from your Google Account under Security → Third-party apps with account access. Syncing stops
          immediately.
        </p>
        <p>
          To have all stored data deleted, open an issue on{" "}
          <a href={REPO} className="text-ink underline decoration-ink-4 underline-offset-4 hover:decoration-ink">
            GitHub
          </a>{" "}
          and it will be removed from the database.
        </p>
      </Section>

      <Section title="Google API data">
        <p>
          Callsheet&rsquo;s use of information received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-ink underline decoration-ink-4 underline-offset-4 hover:decoration-ink"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </Section>
    </main>
  );
}
