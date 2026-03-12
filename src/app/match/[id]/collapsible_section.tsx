"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  overlay?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  overlay = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className={overlay ? "relative" : undefined}>
      <section className="frame rounded-xl p-4">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex w-full items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold text-text-main">{title}</h2>
          </div>
          <CaretDown
            size={14}
            className={`text-text-soft transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded && !overlay && <div className="mt-3">{children}</div>}
      </section>

      {expanded && overlay && (
        <div className="absolute inset-x-0 top-full z-40 mt-2">
          <div className="frame rounded-xl p-4 shadow-xl">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
