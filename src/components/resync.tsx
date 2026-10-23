"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshIcon } from "./icons";

type State = "idle" | "pulling" | "syncing" | "done" | "error";

function timeAgo(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/**
 * Large-title page with pull-to-resync. Pull down at the top, or tap the
 * sync chip, to run /api/cron/sync and refresh the route.
 */
export function Resync({ title, children, lastSyncedAt }: { title: string; children: ReactNode; lastSyncedAt: Date | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [pull, setPull] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);
  const startY = useRef<number | null>(null);

  const sync = useCallback(async () => {
    setState("syncing");
    try {
      const res = await fetch("/api/cron/sync", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { applied: number; fetched: number };
      setSummary(j.applied ? `${j.applied} updated` : "Up to date");
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 2200);
    }
  }, [router]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && state === "idle") startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = Math.max(0, e.touches[0].clientY - startY.current);
      setPull(Math.min(80, dy * 0.5));
      if (dy > 20) setState("pulling");
    };
    const onEnd = () => {
      if (startY.current !== null) {
        if (pull >= 60) void sync();
        else setState((s) => (s === "pulling" ? "idle" : s));
      }
      startY.current = null;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [state, pull, sync]);

  const chip =
    state === "syncing"
      ? "Syncing"
      : state === "done"
        ? summary
        : state === "error"
          ? "Sync failed"
          : lastSyncedAt
            ? timeAgo(lastSyncedAt)
            : "Sync";

  return (
    <div>
      <div
        className="flex justify-center overflow-hidden text-ink-3 transition-[height] duration-200"
        style={{ height: state === "syncing" ? 36 : pull ? pull * 0.6 : 0 }}
        aria-hidden
      >
        <RefreshIcon className={`mt-2 h-5 w-5 ${state === "syncing" ? "animate-spin" : ""}`} />
      </div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-[1.85rem] font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
        <button
          type="button"
          onClick={() => state !== "syncing" && void sync()}
          aria-live="polite"
          className={`press mb-1 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium ${
            state === "error" ? "text-accent" : "text-ink-2"
          }`}
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${state === "syncing" ? "animate-spin" : ""}`} />
          {chip}
        </button>
      </header>
      {children}
    </div>
  );
}
