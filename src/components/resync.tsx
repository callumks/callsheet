"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type State = "idle" | "pulling" | "syncing" | "done" | "error";

/**
 * Pull down from the top of the page to run a sync, or tap the status line.
 * Calls /api/cron/sync with the session cookie, then refreshes the route.
 */
export function Resync({ children, lastSyncedAt }: { children: ReactNode; lastSyncedAt: Date | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const startY = useRef<number | null>(null);
  const pulled = useRef(0);

  const sync = useCallback(async () => {
    if (state === "syncing") return;
    setState("syncing");
    try {
      const res = await fetch("/api/cron/sync", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { applied: number; fetched: number; errors: unknown[] };
      setSummary(
        j.applied ? `${j.applied} updated` : j.fetched ? "Nothing new" : "Inbox quiet",
      );
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 2500);
    }
  }, [router, state]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      pulled.current = e.touches[0].clientY - startY.current;
      if (pulled.current > 24 && state === "idle") setState("pulling");
    };
    const onEnd = () => {
      if (startY.current !== null && pulled.current > 80) void sync();
      else if (state === "pulling") setState("idle");
      startY.current = null;
      pulled.current = 0;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [state, sync]);

  const label =
    state === "syncing"
      ? "Syncing inbox…"
      : state === "pulling"
        ? "Release to sync"
        : state === "done"
          ? summary
          : state === "error"
            ? "Sync failed"
            : lastSyncedAt
              ? `Synced ${timeAgo(lastSyncedAt)}`
              : "Not synced yet";

  return (
    <div>
      <button
        type="button"
        onClick={() => void sync()}
        className={`-mt-1 mb-4 block text-xs ${state === "error" ? "text-accent" : "text-ink-3"}`}
        aria-live="polite"
      >
        {label}
      </button>
      {children}
    </div>
  );
}

function timeAgo(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
