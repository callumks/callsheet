"use client";

import { useRef, useState, useTransition } from "react";

type Props = {
  label: string;
  value: string | null;
  display?: string;
  placeholder?: string;
  type?: "text" | "date" | "time" | "number" | "select";
  options?: { value: string; label: string }[];
  mono?: boolean;
  multiline?: boolean;
  onSave: (raw: string) => Promise<{ error?: string } | void>;
};

/** A row in an inset group. Tap the value to edit; blur or Enter saves; Escape cancels. */
export function InlineField({ label, value, display, placeholder = "Add", type = "text", options, mono, multiline, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const commit = (raw: string) => {
    setEditing(false);
    if (raw === (value ?? "")) return;
    start(async () => {
      const r = await onSave(raw);
      if (r && "error" in r && r.error) {
        setError(r.error);
        setDraft(value ?? "");
      } else {
        setError(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      }
    });
  };

  const open = () => {
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const common = {
    className: `w-full rounded-lg bg-ground px-2 py-1 text-right outline-none ring-1 ring-hairline focus:ring-ink-3 ${mono ? "num" : ""}`,
    value: draft,
    disabled: pending,
    onBlur: () => commit(draft),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit(draft);
      }
      if (e.key === "Escape") setEditing(false);
    },
  };

  return (
    <div className={`flex gap-4 px-4 py-3.5 ${multiline ? "items-start" : "items-center"}`}>
      <span className="shrink-0 text-ink-2">{label}</span>
      <div className="min-w-0 flex-1 text-right">
        {editing ? (
          type === "select" ? (
            <select
              {...common}
              ref={ref as React.RefObject<HTMLSelectElement>}
              onChange={(e) => {
                setDraft(e.target.value);
                commit(e.target.value);
              }}
            >
              {options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : multiline ? (
            <textarea {...common} ref={ref as React.RefObject<HTMLTextAreaElement>} rows={3} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <input
              {...common}
              ref={ref as React.RefObject<HTMLInputElement>}
              type={type === "number" ? "text" : type}
              inputMode={type === "number" ? "decimal" : undefined}
              onChange={(e) => setDraft(e.target.value)}
            />
          )
        ) : (
          <button
            type="button"
            onClick={open}
            className={`max-w-full break-words text-right transition-opacity ${mono ? "num" : ""} ${value === null ? "text-ink-3" : ""} ${pending ? "opacity-40" : ""}`}
          >
            {display ?? value ?? placeholder}
            {saved && <span className="ml-1.5 text-xs text-ink-3">Saved</span>}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-accent">{error}</p>}
      </div>
    </div>
  );
}
