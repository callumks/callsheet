export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-4 h-3 w-24 rounded bg-ink-5" />
      <div className="h-56 rounded-3xl bg-ink-5" />
      <div className="mt-8 h-3 w-20 rounded bg-ink-5" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <span className="h-2 w-2 rounded-full bg-ink-4" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/5 rounded bg-ink-5" />
            <div className="h-3 w-3/5 rounded bg-ink-5" />
          </div>
        </div>
      ))}
    </div>
  );
}
