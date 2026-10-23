export default function Loading() {
  const bar = "rounded-md bg-surface";
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-6 flex items-end justify-between">
        <div className={`h-8 w-40 ${bar}`} />
        <div className="h-7 w-16 rounded-full bg-surface" />
      </div>
      <div className="h-64 rounded-[1.75rem] bg-surface" />
      <div className={`mt-9 h-3 w-24 ${bar}`} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="w-11 space-y-1.5">
            <div className={`mx-auto h-2.5 w-7 ${bar}`} />
            <div className={`mx-auto h-5 w-6 ${bar}`} />
          </div>
          <div className="flex-1 space-y-2">
            <div className={`h-4 w-2/5 ${bar}`} />
            <div className={`h-3 w-3/5 ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
