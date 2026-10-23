"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mt-10 rounded-[1.75rem] bg-surface px-5 py-8 text-center">
      <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
      <p className="mx-auto mt-1 max-w-[16rem] text-sm text-ink-2">This screen didn&apos;t load. Your data is safe.</p>
      {error.digest && <p className="num mt-2 text-xs text-ink-3">{error.digest}</p>}
      <button type="button" onClick={reset} className="press mt-5 h-10 rounded-full bg-ink px-5 text-sm font-medium text-ground">
        Try again
      </button>
    </div>
  );
}
