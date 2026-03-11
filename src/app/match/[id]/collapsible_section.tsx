"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
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

      {expanded && <div className="mt-3">{children}</div>}
    </section>
  );
}
