"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLineUpIcon,
  DatabaseIcon,
  FilmStripIcon,
  GearIcon,
  ListIcon,
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  { href: "/", label: "My Matches", Icon: FilmStripIcon },
  { href: "/debug", label: "Database", Icon: DatabaseIcon },
  { href: "/analysis", label: "Analysis", Icon: ChartLineUpIcon },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-900 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <Link
        href="/"
        aria-label="My Matches"
        className="flex shrink-0 items-center gap-3 px-3 py-4"
      >
        <div
          className="h-8 w-8 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600"
          aria-hidden
        />
        {!collapsed && (
          <span className="min-w-0 truncate font-semibold text-zinc-900 dark:text-zinc-100">
            Bird&apos;s Eye View
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 px-2 pb-3 min-h-0">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center rounded-md py-2 pl-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <ListIcon className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <nav className="flex flex-col gap-1.5" aria-label="Main">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={collapsed ? label : undefined}
                className={`flex items-center rounded-md py-2 text-sm font-medium transition-colors pl-[10px] ${
                  collapsed ? "" : "gap-3"
                } ${
                  active
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {!collapsed && (
                  <span className="min-w-0 truncate">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href="/settings"
            aria-label={collapsed ? "Settings" : undefined}
            className={`flex items-center rounded-md py-2 text-sm font-medium transition-colors pl-[10px] ${
              collapsed ? "" : "gap-3"
            } ${
              pathname.startsWith("/settings")
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <GearIcon className="h-5 w-5 shrink-0" aria-hidden />
            {!collapsed && (
              <span className="min-w-0 truncate">Settings</span>
            )}
          </Link>
        </div>
      </div>
    </aside>
  );
}