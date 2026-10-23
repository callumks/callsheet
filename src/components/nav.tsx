"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Upcoming" },
  { href: "/earnings", label: "Earnings" },
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto flex gap-1 rounded-full bg-ink p-1 text-ground shadow-lg shadow-ink/20">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" || path.startsWith("/jobs") : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active ? "bg-ground text-ink" : "text-ground/70 hover:text-ground"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
