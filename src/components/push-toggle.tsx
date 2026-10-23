"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "denied" | "busy";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function PushToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iOS only exposes PushManager once the PWA is on the home screen.
        setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setState("busy");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("no VAPID key");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const res = await fetch("/api/push?test=1", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  };

  const disable = async () => {
    setState("busy");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
  };

  const text: Record<State, string> = {
    loading: "",
    unsupported: "This browser can't receive notifications.",
    "needs-install": "Add Callsheet to your home screen to get notifications.",
    denied: "Notifications are blocked in settings.",
    off: "",
    on: "",
    busy: "",
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div>Notifications</div>
        <div className="text-sm text-ink-3">{text[state] || "Night before, 2h before call, invoice nudges."}</div>
      </div>
      {(state === "off" || state === "on" || state === "busy") && (
        <button
          type="button"
          role="switch"
          aria-checked={state === "on"}
          disabled={state === "busy"}
          onClick={() => void (state === "on" ? disable() : enable())}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${state === "on" ? "bg-ink" : "bg-ink-4"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-ground transition-all ${state === "on" ? "left-6" : "left-1"}`} />
          <span className="sr-only">Notifications</span>
        </button>
      )}
    </div>
  );
}
