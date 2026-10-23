import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <Link href="/" className="mt-4 inline-block text-ink-2">Back to Upcoming →</Link>
    </main>
  );
}
