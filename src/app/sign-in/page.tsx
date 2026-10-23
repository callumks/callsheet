import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

const messages: Record<string, string> = {
  state: "That sign-in link expired. Try again.",
  exchange: "Google didn't accept the sign-in. Try again.",
  "not-allowed": "That Google account isn't on the allow-list.",
  scope: "Callsheet needs read access to Gmail to find your bookings.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  const msg = typeof error === "string" ? messages[error] : undefined;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))]">
      <div className="rise flex flex-1 flex-col justify-center">
        <div className="flex gap-1.5" aria-hidden>
          <span className="dot dot-confirmed h-3.5 w-3.5" />
          <span className="dot dot-option_1 h-3.5 w-3.5" />
          <span className="dot dot-option_2 h-3.5 w-3.5" />
        </div>
        <h1 className="mt-8 text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.035em]">Callsheet</h1>
        <p className="mt-3 text-lg leading-snug text-ink-2">Every booking, call time and unpaid invoice, read straight from your inbox.</p>
      </div>

      <div className="rise">
        {msg && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{msg}</p>}
        <a
          href="/api/auth/google"
          className="press flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-ink py-4 text-[0.95rem] font-medium text-ground"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
            <GoogleMark />
          </span>
          Continue with Google
        </a>
        <p className="mt-4 text-center text-xs leading-relaxed text-ink-3">
          Read-only Gmail access. Emails are read to find bookings and never stored.
        </p>
      </div>
    </main>
  );
}
