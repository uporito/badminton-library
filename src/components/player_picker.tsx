"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CaretDown, Plus, X } from "@phosphor-icons/react";

interface PlayerOption {
  id: number;
  name: string;
}

export interface SpecialOption {
  key: string;
  label: string;
}

interface PlayerPickerProps {
  /** Selected value: player id (number), special option key (string), or null */
  value: number | string | null;
  onChange: (value: number | string | null, displayName: string) => void;
  /** Player IDs to exclude from the list (e.g. already picked in another slot) */
  exclude?: number[];
  /** Non-player options shown at the top of the dropdown (e.g. "None", "Unknown") */
  specialOptions?: SpecialOption[];
  placeholder?: string;
  label?: string;
  clearable?: boolean;
  className?: string;
}

export function PlayerPicker({
  value,
  onChange,
  exclude = [],
  specialOptions = [],
  placeholder = "Select player",
  label = "Player",
  clearable = false,
  className,
}: PlayerPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allPlayers, setAllPlayers] = useState<PlayerOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPlayers = useCallback(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((data: PlayerOption[]) => setAllPlayers(data))
      .catch(() => setAllPlayers([]));
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const excludeSet = new Set(exclude);
  const available = allPlayers.filter((p) => !excludeSet.has(p.id));

  const trimmedQuery = query.trim();
  const filtered = available.filter((p) =>
    p.name.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );
  const filteredSpecial = specialOptions.filter((s) =>
    s.label.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );
  const allNames = [
    ...available.map((p) => p.name.toLowerCase()),
    ...specialOptions.map((s) => s.label.toLowerCase()),
  ];
  const exactMatch = allNames.includes(trimmedQuery.toLowerCase());
  const showAddOption = trimmedQuery.length > 0 && !exactMatch;

  const selectedSpecial = typeof value === "string"
    ? specialOptions.find((s) => s.key === value)
    : undefined;
  const selectedPlayer = typeof value === "number"
    ? allPlayers.find((p) => p.id === value)
    : undefined;
  const displayName = selectedSpecial?.label ?? selectedPlayer?.name ?? null;

  function selectPlayer(player: PlayerOption) {
    onChange(player.id, player.name);
    setQuery("");
    setOpen(false);
  }

  function selectSpecial(opt: SpecialOption) {
    onChange(opt.key, opt.label);
    setQuery("");
    setOpen(false);
  }

  async function addAndSelect(name: string) {
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const created: PlayerOption = await res.json();
      setAllPlayers((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [...prev, created].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });
      onChange(created.id, created.name);
      setQuery("");
      setOpen(false);
    } catch {
      /* ignore */
    }
  }

  function handleOpen() {
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const hasValue = value != null;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={open ? () => setOpen(false) : handleOpen}
        className="flex w-full items-center justify-between gap-1.5 rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main hover:bg-ui-elevated-more transition-colors focus:outline-none focus:ring-1 focus:ring-ui-elevated-more"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span
          className={`truncate ${displayName ? "" : "text-text-soft/50"}`}
        >
          {displayName ?? placeholder}
        </span>
        <span className="flex items-center gap-1">
          {clearable && hasValue && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null, "");
              }}
              className="rounded p-0.5 hover:bg-ui-elevated-more"
            >
              <X className="h-3 w-3 text-text-soft" weight="bold" />
            </span>
          )}
          <CaretDown
            className={`h-3 w-3 shrink-0 text-text-soft transition-transform ${open ? "rotate-180" : ""}`}
            weight="bold"
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-0 overflow-hidden rounded-xl bg-ui-elevated p-1.5 shadow-[0_8px_24px_-4px_rgb(0_0_0_/0.15),0_4px_12px_-2px_rgb(0_0_0_/0.10)] dark:shadow-[0_12px_32px_-4px_rgb(0_0_0_/0.45),0_6px_16px_-4px_rgb(0_0_0_/0.30)]"
          role="listbox"
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (showAddOption) {
                  addAndSelect(trimmedQuery);
                } else if (filteredSpecial.length === 1 && filtered.length === 0) {
                  selectSpecial(filteredSpecial[0]);
                } else if (filtered.length === 1 && filteredSpecial.length === 0) {
                  selectPlayer(filtered[0]);
                }
              }
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search or add…"
            className="mb-1.5 w-full rounded-lg bg-ui-elevated-more px-2.5 py-1.5 text-sm text-text-main placeholder:text-text-soft/50 focus:outline-none"
          />

          <ul className="max-h-48 space-y-px overflow-y-auto">
            {filteredSpecial.map((s) => {
              const isSelected = value === s.key;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectSpecial(s)}
                    className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm italic transition-colors ${
                      isSelected
                        ? "bg-ui-elevated-more text-text-main"
                        : "text-text-soft hover:bg-ui-elevated-more"
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
            {filteredSpecial.length > 0 && filtered.length > 0 && (
              <li className="mx-1.5 my-1 border-t border-ui-elevated-more" aria-hidden />
            )}
            {showAddOption && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => addAndSelect(trimmedQuery)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-accent transition-colors hover:bg-ui-elevated-more"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" weight="bold" />
                  Add &ldquo;{trimmedQuery}&rdquo;
                </button>
              </li>
            )}
            {filtered.map((p) => {
              const isSelected = value === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectPlayer(p)}
                    className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-ui-elevated-more text-text-main"
                        : "text-text-soft hover:bg-ui-elevated-more"
                    }`}
                  >
                    {p.name}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && filteredSpecial.length === 0 && !showAddOption && (
              <li className="px-2.5 py-1.5 text-sm text-text-soft/60">
                No players found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
