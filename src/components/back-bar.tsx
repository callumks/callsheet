"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft } from "./icons";

/** Sticky back bar: clear at the top, frosted once content scrolls under it. */
export function BackBar({ href, label }: { href: string; label: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div
      className={`sticky top-0 z-30 -mx-4 mb-2 px-2 py-2 transition-[background-color,box-shadow] duration-200 ${
        scrolled ? "bg-chrome shadow-[0_1px_0_var(--hairline)] backdrop-blur-xl backdrop-saturate-150" : ""
      }`}
    >
      <Link href={href} className="press inline-flex items-center gap-0.5 rounded-full py-1.5 pl-1 pr-3 text-[0.95rem] text-ink-2 hover:text-ink">
        <ChevronLeft />
        {label}
      </Link>
    </div>
  );
}
