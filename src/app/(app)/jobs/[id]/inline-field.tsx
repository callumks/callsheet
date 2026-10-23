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

/** Tap the value to edit it; blur or Enter saves; Escape cancels. */
export function InlineField({ label, value, display, placeholder = "—", type = "text", options, mono, multiline, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
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
      } else setError(null);
    });
  };

  const open = () => {
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const common = {
    className: `w-full bg-transparent text-right outline-none ${mono ? "num" : ""}`,
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
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="shrink-0 text-ink-3">{label}</span>
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
            className={`max-w-full break-words text-right ${mono ? "num" : ""} ${value === null ? "text-ink-3" : ""} ${pending ? "opacity-50" : ""}`}
          >
            {display ?? value ?? placeholder}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-accent">{error}</p>}
      </div>
    </div>
  );
}
