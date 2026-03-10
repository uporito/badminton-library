"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-based day-of-week (0 = Mon, 6 = Sun). */
function startDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function todayISO(): { year: number; month: number; day: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initial = value
    ? { year: +value.slice(0, 4), month: +value.slice(5, 7) - 1 }
    : { year: todayISO().year, month: todayISO().month };
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  useEffect(() => {
    if (!open) return;
    if (value) {
      setViewYear(+value.slice(0, 4));
      setViewMonth(+value.slice(5, 7) - 1);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    },
    [],
  );

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }

  function clearDate() {
    onChange("");
    setOpen(false);
  }

  const days = daysInMonth(viewYear, viewMonth);
  const offset = startDayOfWeek(viewYear, viewMonth);
  const today = todayISO();
  const selectedISO = value;

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main hover:bg-ui-elevated-more transition-colors focus:outline-none focus:ring-1 focus:ring-ui-elevated-more"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Date"
      >
        <span className={value ? "truncate" : "truncate text-text-soft/50"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <CaretDown
          className={`h-3 w-3 shrink-0 text-text-soft transition-transform ${open ? "rotate-180" : ""}`}
          weight="bold"
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl bg-ui-elevated p-3 shadow-[0_8px_24px_-4px_rgb(0_0_0_/0.15),0_4px_12px_-2px_rgb(0_0_0_/0.10)] dark:shadow-[0_12px_32px_-4px_rgb(0_0_0_/0.45),0_6px_16px_-4px_rgb(0_0_0_/0.30)]"
          role="dialog"
          aria-label="Date picker"
        >
          {/* Month / year navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-soft hover:bg-ui-elevated-more hover:text-text-main transition-colors"
              aria-label="Previous month"
            >
              <CaretLeft weight="bold" className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-semibold text-text-main">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-soft hover:bg-ui-elevated-more hover:text-text-main transition-colors"
              aria-label="Next month"
            >
              <CaretRight weight="bold" className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAY_LABELS.map((d) => (
              <span key={d} className="text-[10px] font-medium uppercase tracking-wider text-text-soft">
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, i) => {
              if (day === null) {
                return <span key={`empty-${i}`} />;
              }
              const mm = String(viewMonth + 1).padStart(2, "0");
              const dd = String(day).padStart(2, "0");
              const cellISO = `${viewYear}-${mm}-${dd}`;
              const isSelected = cellISO === selectedISO;
              const isToday =
                viewYear === today.year &&
                viewMonth === today.month &&
                day === today.day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-accent text-white"
                      : isToday
                        ? "bg-ui-elevated-more text-text-main"
                        : "text-text-soft hover:bg-ui-elevated-more hover:text-text-main"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer: Today shortcut + Clear */}
          <div className="mt-2 flex items-center justify-between border-t border-ui-elevated-more/40 pt-2">
            <button
              type="button"
              onClick={() => {
                const t = todayISO();
                const mm = String(t.month + 1).padStart(2, "0");
                const dd = String(t.day).padStart(2, "0");
                onChange(`${t.year}-${mm}-${dd}`);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-ui-elevated-more transition-colors"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={clearDate}
                className="rounded-md px-2 py-1 text-xs font-medium text-text-soft hover:bg-ui-elevated-more hover:text-text-main transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
