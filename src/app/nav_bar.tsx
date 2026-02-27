"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "My Matches" },
  { href: "/debug", label: "Database" },
  { href: "/analysis", label: "Analysis" },
] as const;

export function NavBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 p-4">
        <div
          className="h-10 w-10 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600"
          aria-hidden
        />
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          Bird&apos;s Eye View
        </span>
      </div>
      <nav className="flex flex-col gap-0.5 p-3" aria-label="Main">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
