import { BackBar } from "@/components/page-header";

export default function JobNotFound() {
  return (
    <div>
      <BackBar href="/" label="Upcoming" />
      <div className="mt-10 rounded-[1.75rem] bg-surface px-5 py-8 text-center">
        <h1 className="text-lg font-semibold tracking-tight">Job not found</h1>
        <p className="mx-auto mt-1 max-w-[16rem] text-sm text-ink-2">It may have been merged into another job from the same email thread.</p>
      </div>
    </div>
  );
}
