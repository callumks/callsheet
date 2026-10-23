"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChartIcon } from "./icons";

const items = [
  { href: "/", label: "Upcoming", Icon: CalendarIcon },
  { href: "/earnings", label: "Earnings", Icon: ChartIcon },
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <>
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-28 bg-gradient-to-t from-ground via-ground/80 to-transparent" />
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex gap-1 rounded-full bg-chrome p-1.5 shadow-[0_8px_30px_-6px_rgb(0_0_0/0.18),0_0_0_1px_var(--hairline)] backdrop-blur-xl backdrop-saturate-150">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" || path.startsWith("/jobs") || path === "/review" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`press flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.9rem] font-medium ${
                active ? "bg-ink text-ground" : "text-ink-2 hover:text-ink"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
