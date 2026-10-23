import Link from "next/link";

export default function JobNotFound() {
  return (
    <div>
      <Link href="/" className="text-sm text-ink-3">← Upcoming</Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Job not found</h1>
      <p className="mt-1 text-ink-2">It may have been merged into another job from the same thread.</p>
    </div>
  );
}
