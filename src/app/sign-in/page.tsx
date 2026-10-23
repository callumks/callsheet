import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

const messages: Record<string, string> = {
  state: "That sign-in link expired. Try again.",
  exchange: "Google didn't accept the sign-in. Try again.",
  "not-allowed": "That Google account isn't on the allow-list.",
  scope: "Gmail read access is needed to sync bookings.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  const msg = typeof error === "string" ? messages[error] : undefined;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <span className="dot dot-confirmed mb-6 h-4 w-4" aria-hidden />
      <h1 className="text-3xl font-semibold tracking-tight">Callsheet</h1>
      <p className="mt-2 text-ink-2">
        Bookings, call times and what you&apos;re owed, read straight from your inbox.
      </p>
      {msg && <p className="mt-6 text-sm text-accent">{msg}</p>}
      <a
        href="/api/auth/google"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-medium text-ground"
      >
        Continue with Google
      </a>
      <p className="mt-4 text-xs text-ink-3">
        Read-only Gmail access. Email bodies are read for extraction and never stored.
      </p>
    </main>
  );
}
