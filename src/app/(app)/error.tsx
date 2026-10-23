"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-3xl bg-ink-5 p-5">
      <h1 className="text-xl font-semibold tracking-tight">Something broke</h1>
      <p className="mt-1 text-ink-2">The page couldn&apos;t load. Your data is fine.</p>
      {error.digest && <p className="num mt-2 text-xs text-ink-3">{error.digest}</p>}
      <button type="button" onClick={reset} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-ground">
        Try again
      </button>
    </div>
  );
}
