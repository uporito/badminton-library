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
      className={`frame sticky top-0 flex h-screen shrink-0 flex-col transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <Link
        href="/"
        aria-label="My Matches"
        className="flex shrink-0 items-center gap-3 px-3 py-4"
      >
        <div
          className="h-8 w-8 shrink-0 rounded-full bg-ui-elevated-more"
          aria-hidden
        />
        {!collapsed && (
          <span className="min-w-0 truncate font-semibold text-text-main">
            Bird&apos;s Eye View
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 px-2 pb-3 min-h-0">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center rounded-md py-2 pl-[10px] text-text-soft hover:bg-ui-elevated hover:text-text-main"
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
                    ? "bg-accent text-text-main"
                    : "text-text-soft hover:text-accent"
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
        <div className="mt-auto pt-3 border-t border-ui-elevated">
          <Link
            href="/settings"
            aria-label={collapsed ? "Settings" : undefined}
            className={`flex items-center rounded-md py-2 text-sm font-medium transition-colors pl-[10px] ${
              collapsed ? "" : "gap-3"
            } ${
              pathname.startsWith("/settings")
                ? "bg-accent text-text-main"
                : "text-text-soft hover:text-accent"
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