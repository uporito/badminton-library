"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CircleNotchIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { Court3D, type SelectedZone } from "@/app/analysis/court_3d";
import { AnalysisShotSelection } from "@/app/analysis/analysis_shot_selection";
import { AnalysisOutcomesChart } from "@/app/analysis/analysis_outcomes_chart";
import {
  type ShotForStats,
  getMostPlayedShotByCourt,
  filterShotsByCourtRow,
  filterShotsByZone,
  SHOT_TYPE_HEX,
  SHOT_TYPE_LABELS,
  type CourtRow,
} from "@/lib/shot_chart_utils";
import type { ShotType, Zone, Side } from "@/db/schema";
import { parseTags } from "@/lib/tags";

/** Resolve shot-type hex from display label so tint always matches the card text */
function hexForShotLabel(label: string | null): string | null {
  if (label == null) return null;
  const entry = (Object.entries(SHOT_TYPE_LABELS) as [ShotType, string][]).find(
    ([, l]) => l === label
  );
  const shotType = entry?.[0];
  return shotType != null ? SHOT_TYPE_HEX[shotType] : null;
}

type MatchRow = {
  id: number;
  title: string;
  date: string | null;
  opponent: string | null;
  result: string | null;
  category: string | null;
  tags: string | null;
};

interface AnalysisDashboardProps {
  matches: MatchRow[];
  allTags: string[];
}

const WEEKS_IN_YEAR = 52;
const DAYS_PER_WEEK = 7;
const TOTAL_DAYS = WEEKS_IN_YEAR * DAYS_PER_WEEK;

const GRID_COLOR_EMPTY = "#f4f4f5";
const GRID_COLOR_FULL = "#15803d";

function interpolateHex(hexFrom: string, hexTo: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
  };
  const [r1, g1, b1] = parse(hexFrom);
  const [r2, g2, b2] = parse(hexTo);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function formatLongDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${ordinal(date.getDate())}, ${date.getFullYear()}`;
}

type AnalysisTab = "global" | "shot-patterns" | "shot-analysis";

const TABS: { id: AnalysisTab; label: string }[] = [
  { id: "global", label: "Global Analysis" },
  { id: "shot-patterns", label: "Shot Patterns" },
  { id: "shot-analysis", label: "Shot Analysis" },
];

interface MatchTimelineGridProps {
  matches: MatchRow[];
}

type GridTooltipState = { dateKey: string; x: number; y: number } | null;

function MatchTimelineGrid({ matches }: MatchTimelineGridProps) {
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matches) {
      if (!m.date) continue;
      const key = m.date.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        map[key] = (map[key] ?? 0) + 1;
      }
    }
    return map;
  }, [matches]);

  const matchesByDate = useMemo(() => {
    const map: Record<string, MatchRow[]> = {};
    for (const m of matches) {
      if (!m.date) continue;
      const key = m.date.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        if (!map[key]) map[key] = [];
        map[key].push(m);
      }
    }
    return map;
  }, [matches]);

  const [hoveredCell, setHoveredCell] = useState<GridTooltipState>(null);
  const maxCount = Math.max(1, ...Object.values(countByDate));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = (() => {
    const first = addDays(today, -TOTAL_DAYS + 1);
    const d = first.getDay();
    return addDays(first, -(d === 0 ? 6 : d - 1));
  })();

  const monthLabels = Array.from({ length: WEEKS_IN_YEAR }, (_, c) => {
    const date = addDays(startDate, c * DAYS_PER_WEEK);
    const month = date.getMonth();
    const prevDate = c > 0 ? addDays(startDate, (c - 1) * DAYS_PER_WEEK) : null;
    const isFirstOfMonth = prevDate === null || prevDate.getMonth() !== month;
    return isFirstOfMonth
      ? date.toLocaleString("en-US", { month: "short" }).toUpperCase()
      : null;
  });

  const dayLabelSlots = [null, "Mon", null, "Wed", null, "Fri", null, "Sun"] as const;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] gap-2 items-stretch">
        <div className="flex flex-col justify-between text-xs text-text-soft">
          {dayLabelSlots.map((label, i) => (
            <span key={i} className="leading-none" aria-hidden>
              {label ?? "\u00A0"}
            </span>
          ))}
        </div>
        <div
          className="min-w-0 overflow-x-auto p-0.5"
          onMouseLeave={() => setHoveredCell(null)}
        >
          {hoveredCell != null &&
            typeof document !== "undefined" &&
            createPortal(
              (() => {
                const dayMatches = matchesByDate[hoveredCell!.dateKey] ?? [];
                const date = new Date(hoveredCell!.dateKey);
                return (
                  <div
                    className="frame-glass pointer-events-none fixed z-[100] max-w-sm rounded-xl px-4 py-3 text-xs shadow-lg"
                    style={{
                      left: hoveredCell!.x + 12,
                      top: hoveredCell!.y + 12,
                    }}
                  >
                    <p className="font-medium text-text-main">
                      {formatLongDate(date)}
                    </p>
                    <ul className="mt-2 space-y-1 border-t border-zinc-600 pt-2">
                      {dayMatches.length === 0 ? (
                        <li className="text-text-main">No matches played</li>
                      ) : (
                        dayMatches.map((m) => (
                          <li key={m.id} className="text-text-main">
                            <a
                              href={`/match/${m.id}`}
                              className="hover:underline"
                            >
                              {m.title}
                              {m.opponent ? ` vs ${m.opponent}` : ""}
                              {m.result ? ` ${m.result}` : ""}
                            </a>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })(),
              document.body
            )}
          <div
            className="grid w-full min-w-[320px] gap-x-1 text-xs text-text-soft"
            style={{
              gridTemplateColumns: `repeat(${WEEKS_IN_YEAR}, minmax(0, 1fr))`,
            }}
          >
            {monthLabels.map((label, c) => (
              <div key={c} className="pb-0.5 leading-none">
                {label}
              </div>
            ))}
          </div>
          <div
            className="grid w-full min-w-[320px] gap-0.5 rounded-[1px] mt-0.5"
            style={{
              gridTemplateColumns: `repeat(${WEEKS_IN_YEAR}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${DAYS_PER_WEEK}, minmax(0, 1fr))`,
              aspectRatio: `${WEEKS_IN_YEAR} / ${DAYS_PER_WEEK}`,
            }}
          >
            {Array.from({ length: DAYS_PER_WEEK * WEEKS_IN_YEAR }, (_, i) => {
              const row = Math.floor(i / WEEKS_IN_YEAR);
              const col = i % WEEKS_IN_YEAR;
              const dayIndex = col * DAYS_PER_WEEK + row;
              const date = addDays(startDate, dayIndex);
              const dateKey = toDateString(date);
              const count = countByDate[dateKey] ?? 0;
              const t = maxCount > 0 ? Math.min(1, count / maxCount) : 0;
              const bg =
                count === 0
                  ? undefined
                  : interpolateHex(GRID_COLOR_EMPTY, GRID_COLOR_FULL, t);
              const isHovered = hoveredCell?.dateKey === dateKey;
              return (
                <div
                  key={`${col}-${row}`}
                  className={`min-h-0 min-w-0 rounded-[1px] ${count === 0 ? "bg-ui-elevated" : ""} ${isHovered ? "ring-2 ring-accent" : ""}`}
                  style={bg != null ? { backgroundColor: bg } : undefined}
                  onMouseEnter={(e) =>
                    setHoveredCell({
                      dateKey,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-soft">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className={`h-[8px] w-[8px] rounded-[1px] ${t === 0 ? "bg-ui-elevated" : ""}`}
              style={
                t > 0
                  ? {
                      backgroundColor: interpolateHex(
                        GRID_COLOR_EMPTY,
                        GRID_COLOR_FULL,
                        t
                      ),
                    }
                  : undefined
              }
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

const COURT_ROW_LABELS: Record<CourtRow, string> = {
  front: "Front Court",
  mid: "Mid Court",
  back: "Back Court",
};

/** Diagonal gradient 2% → 10% opacity with lighten blend, for shot-type tint on cards */
function ShotTintOverlay({ hex }: { hex: string }) {
  const from = `${hex}05`;
  const to = `${hex}1a`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-lg"
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        mixBlendMode: "lighten",
      }}
    />
  );
}

function MostPlayedShotCard({
  courtRow,
  metric,
  selected,
  onSelect,
  className,
}: {
  courtRow: CourtRow;
  metric: { label: string; percentage: number } | null;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const courtLabel = COURT_ROW_LABELS[courtRow];
  const isSelected = selected;
  const tintHex = hexForShotLabel(metric?.label ?? null);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative cursor-pointer rounded-lg px-4 py-3 flex flex-row items-center justify-between gap-4 min-h-0 text-left transition-colors outline-none hover:ring-2 hover:ring-accent focus-visible:ring-2 focus-visible:ring-accent ${className ?? ""}`}
    >
      {/* Background layer so .frame box-shadow does not override the button's hover ring */}
      <div
        className={`absolute inset-0 rounded-lg ${isSelected ? "bg-accent" : "frame"}`}
        aria-hidden
      />
      {!isSelected && tintHex != null && <ShotTintOverlay hex={tintHex} />}
      <div className="relative flex flex-col justify-center gap-0.5 min-w-0 shrink z-[1]">
        <span
          className={`text-xs font-normal ${isSelected ? "text-text-main" : "text-text-soft"}`}
        >
          {courtLabel}
        </span>
        <span className="font-normal text-sm text-text-main">
          {metric?.label ?? "—"}
        </span>
      </div>
      <span className="relative text-4xl font-normal tabular-nums shrink-0 z-[1] text-text-main">
        {metric != null ? `${metric.percentage} %` : "—"}
      </span>
    </button>
  );
}

// ─── Filter dropdown ──────────────────────────────────────────────────────────

interface FilterOption {
  value: string;
  label: string;
}

function FilterDropdown({
  dropdownId,
  label,
  options,
  selected,
  onToggle,
  searchable = false,
  showSelectionLabel = false,
  minWidthText,
  isOpen,
  onToggleOpen,
}: {
  dropdownId: string;
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  searchable?: boolean;
  /** When true, shows the selected option's label instead of a count */
  showSelectionLabel?: boolean;
  /** Overrides the invisible width-spacer text (defaults to "{label} (ALL)") */
  minWidthText?: string;
  isOpen: boolean;
  onToggleOpen: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      return;
    }
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onToggleOpen();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onToggleOpen]);

  const triggerLabel = useMemo(() => {
    if (selected.size === 0) return label;
    if (showSelectionLabel && selected.size === 1) {
      const val = [...selected][0];
      return options.find((o) => o.value === val)?.label ?? label;
    }
    if (selected.size === options.length && options.length > 0) return `${label} (ALL)`;
    return `${label} (${selected.size})`;
  }, [selected, options, label, showSelectionLabel]);

  const visibleOptions = useMemo(
    () =>
      search
        ? options.filter((o) =>
            o.label.toLowerCase().includes(search.toLowerCase())
          )
        : options,
    [options, search]
  );

  return (
    <div ref={containerRef} className="relative flex-none">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex items-center gap-1.5 rounded-lg bg-ui-frame px-3 py-1.5 text-xs text-text-main hover:bg-ui-elevated transition-colors cursor-pointer"
      >
        {/* Invisible spacer fixes the button width */}
        <span className="relative inline-flex items-center">
          <span className="invisible whitespace-nowrap" aria-hidden>
            {minWidthText ?? `${label} (ALL)`}
          </span>
          <span className="absolute inset-0 flex items-center whitespace-nowrap">
            {triggerLabel}
          </span>
        </span>
        <CaretDownIcon
          className={`h-3 w-3 shrink-0 text-text-soft transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div className="filter-dropdown-panel absolute right-0 top-full mt-1.5 z-50 min-w-[180px]">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-ui-elevated-more px-3 py-2">
              <MagnifyingGlassIcon
                className="h-3 w-3 shrink-0 text-text-soft"
                aria-hidden
              />
              <input
                autoFocus
                type="text"
                placeholder="Search matches"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs text-text-main placeholder:text-text-soft outline-none"
              />
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto p-1.5 space-y-px">
            {visibleOptions.map((opt) => {
              const checked = selected.has(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => onToggle(opt.value)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                      checked
                        ? "text-text-main"
                        : "text-text-soft hover:bg-ui-elevated-more"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                        checked
                          ? "bg-accent"
                          : "bg-ui-elevated"
                      }`}
                    >
                      {checked && (
                        <CheckIcon
                          className="h-2.5 w-2.5 text-ui-bg"
                          weight="bold"
                          aria-hidden
                        />
                      )}
                    </span>
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Player filter options ────────────────────────────────────────────────────

const PLAYER_OPTIONS: FilterOption[] = [
  { value: "both", label: "Shots by Both" },
  { value: "me", label: "Shots by Me" },
  { value: "opponent", label: "Shots by Opponent" },
];

const CATEGORY_OPTIONS: FilterOption[] = [
  { value: "Singles", label: "Singles" },
  { value: "Doubles", label: "Doubles" },
  { value: "Mixed", label: "Mixed" },
];

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function AnalysisDashboard({ matches, allTags }: AnalysisDashboardProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("global");
  const [shots, setShots] = useState<ShotForStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourtRow, setSelectedCourtRow] = useState<CourtRow | null>(null);
  const [selectedZone, setSelectedZone] = useState<SelectedZone>(null);

  // Filter state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [selectedOpponents, setSelectedOpponents] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedPlayer, setSelectedPlayer] = useState<string>("me");

  // Unique opponents derived from matches (sorted alphabetically)
  const opponentOptions = useMemo<FilterOption[]>(() => {
    const unique = [
      ...new Set(
        matches
          .map((m) => m.opponent)
          .filter((o): o is string => o != null && o.trim() !== "")
      ),
    ].sort();
    return unique.map((o) => ({ value: o, label: o }));
  }, [matches]);

  const tagOptions = useMemo<FilterOption[]>(
    () => allTags.map((t) => ({ value: t, label: t })),
    [allTags]
  );

  const matchOptions = useMemo<FilterOption[]>(
    () => matches.map((m) => ({ value: String(m.id), label: m.title })),
    [matches]
  );

  /**
   * Serialised key representing the effective set of match IDs to query.
   * "all"   → no match-based filter, fetch everything
   * "empty" → filters active but no match survives → return []
   * "1,2,3" → fetch only these IDs
   */
  const shotsQueryKey = useMemo<string>(() => {
    const hasFilter =
      selectedMatchIds.size > 0 ||
      selectedOpponents.size > 0 ||
      selectedCategories.size > 0 ||
      selectedTags.size > 0;
    if (!hasFilter) return "all";

    let filtered = matches;
    if (selectedMatchIds.size > 0) {
      filtered = filtered.filter((m) => selectedMatchIds.has(m.id));
    }
    if (selectedOpponents.size > 0) {
      filtered = filtered.filter(
        (m) => m.opponent != null && selectedOpponents.has(m.opponent)
      );
    }
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(
        (m) => m.category != null && selectedCategories.has(m.category)
      );
    }
    if (selectedTags.size > 0) {
      filtered = filtered.filter((m) => {
        const mTags = parseTags(m.tags);
        return [...selectedTags].some((t) => mTags.includes(t));
      });
    }
    const ids = filtered
      .map((m) => m.id)
      .sort((a, b) => a - b)
      .join(",");
    return ids === "" ? "empty" : ids;
  }, [matches, selectedMatchIds, selectedOpponents, selectedCategories, selectedTags]);

  // Re-fetch shots whenever the effective match filter changes
  useEffect(() => {
    if (shotsQueryKey === "empty") {
      setShots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const url =
      shotsQueryKey === "all"
        ? "/api/stats/shots"
        : `/api/stats/shots?matchIds=${shotsQueryKey}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then(
        (
          raw: {
            shotType: string;
            outcome: string;
            player: string;
            zoneFrom: string;
            zoneTo: string;
            zoneFromSide: string;
            zoneToSide: string;
          }[]
        ) => {
          setShots(
            raw.map((s) => ({
              shotType: s.shotType,
              outcome: s.outcome,
              player: s.player,
              zoneFrom: s.zoneFrom,
              zoneTo: s.zoneTo,
              zoneFromSide: s.zoneFromSide,
              zoneToSide: s.zoneToSide,
            })) as ShotForStats[]
          );
        }
      )
      .catch(() => setShots([]))
      .finally(() => setLoading(false));
  }, [shotsQueryKey]);

  // Apply player filter client-side
  const playerFilteredShots = useMemo(() => {
    if (selectedPlayer === "both") return shots;
    return shots.filter((s) => s.player === selectedPlayer);
  }, [shots, selectedPlayer]);

  const filteredShots = useMemo(() => {
    if (selectedZone != null)
      return filterShotsByZone(playerFilteredShots, selectedZone);
    return filterShotsByCourtRow(playerFilteredShots, selectedCourtRow);
  }, [playerFilteredShots, selectedZone, selectedCourtRow]);

  const mostPlayedByCourt = useMemo(
    () => getMostPlayedShotByCourt(filteredShots),
    [filteredShots]
  );

  function handleCourtCardClick(courtRow: CourtRow) {
    setSelectedZone(null);
    setSelectedCourtRow((prev) => (prev === courtRow ? null : courtRow));
  }

  function handleZoneClick(zone: Zone, side: Side) {
    setSelectedCourtRow(null);
    setSelectedZone((prev) =>
      prev?.zone === zone && prev?.side === side ? null : { zone, side }
    );
  }

  function toggleDropdown(id: string) {
    setOpenDropdown((prev) => (prev === id ? null : id));
  }

  function toggleSet(
    set: Set<string | number>,
    value: string | number
  ): Set<string | number> {
    const next = new Set(set) as Set<string | number>;
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  }

  return (
    <div className="w-full flex flex-col">
      <nav
        className="flex items-center justify-between gap-4 border-b border-ui-elevated pb-3 mb-5 flex-wrap"
        aria-label="Analysis sections"
      >
        {/* Tabs */}
        <div className="flex gap-6">
          {TABS.map(({ id, label }) => (
            <div key={id} className="relative pb-3 -mb-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab(id)}
                className={`text-sm font-medium transition-colors ${
                  activeTab === id
                    ? "text-accent"
                    : "text-text-soft hover:text-text-main"
                }`}
              >
                {label}
              </button>
              {activeTab === id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <FilterDropdown
            dropdownId="matches"
            label="Matches"
            options={matchOptions}
            selected={
              new Set([...selectedMatchIds].map(String)) as Set<string>
            }
            onToggle={(val) =>
              setSelectedMatchIds(
                toggleSet(selectedMatchIds, Number(val)) as Set<number>
              )
            }
            searchable
            isOpen={openDropdown === "matches"}
            onToggleOpen={() => toggleDropdown("matches")}
          />
          <FilterDropdown
            dropdownId="opponent"
            label="Opponent"
            options={opponentOptions}
            selected={selectedOpponents}
            onToggle={(val) =>
              setSelectedOpponents(
                toggleSet(selectedOpponents, val) as Set<string>
              )
            }
            isOpen={openDropdown === "opponent"}
            onToggleOpen={() => toggleDropdown("opponent")}
          />
          <FilterDropdown
            dropdownId="category"
            label="Type"
            options={CATEGORY_OPTIONS}
            selected={selectedCategories}
            onToggle={(val) =>
              setSelectedCategories(
                toggleSet(selectedCategories, val) as Set<string>
              )
            }
            isOpen={openDropdown === "category"}
            onToggleOpen={() => toggleDropdown("category")}
          />
          {tagOptions.length > 0 && (
            <FilterDropdown
              dropdownId="tags"
              label="Tags"
              options={tagOptions}
              selected={selectedTags}
              onToggle={(val) =>
                setSelectedTags(
                  toggleSet(selectedTags, val) as Set<string>
                )
              }
              searchable={tagOptions.length > 6}
              isOpen={openDropdown === "tags"}
              onToggleOpen={() => toggleDropdown("tags")}
            />
          )}
          <FilterDropdown
            dropdownId="player"
            label="Shots by"
            options={PLAYER_OPTIONS}
            selected={new Set([selectedPlayer])}
            onToggle={(val) => setSelectedPlayer(val)}
            showSelectionLabel
            minWidthText="Shots by Opponent"
            isOpen={openDropdown === "player"}
            onToggleOpen={() => toggleDropdown("player")}
          />
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-0">
        {/* Left: visuals with frame, overlapping court slightly */}
        <div className="flex flex-col gap-6 lg:mr-[-2rem]">
          {/* Top row: 2 cols — left: donut + legend (wider), right: 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-5">
            <div className="frame relative z-10 rounded-xl p-5 min-h-0 flex flex-col h-[260px]">
              <h2 className="mb-3 text-xs font-semibold text-text-main shrink-0">
                Shot Selection
              </h2>
              <div className="flex-1 min-h-0">
                {loading ? (
                  <p className="flex items-center gap-2 text-xs text-text-soft">
                    <CircleNotchIcon
                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                      aria-hidden
                    />
                    Loading…
                  </p>
                ) : (
                  <AnalysisShotSelection
                    shots={filteredShots}
                    className="h-full"
                  />
                )}
              </div>
            </div>
            <div className="relative z-10 flex flex-col gap-3 min-h-0 h-[260px]">
              <p className="text-xs font-semibold text-text-main shrink-0">
                Most Played Shots
              </p>
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <MostPlayedShotCard
                  courtRow="front"
                  metric={
                    mostPlayedByCourt.front
                      ? {
                          label: mostPlayedByCourt.front.label,
                          percentage: mostPlayedByCourt.front.percentage,
                        }
                      : null
                  }
                  selected={selectedCourtRow === "front"}
                  onSelect={() => handleCourtCardClick("front")}
                  className="flex-1 min-h-0"
                />
                <MostPlayedShotCard
                  courtRow="mid"
                  metric={
                    mostPlayedByCourt.mid
                      ? {
                          label: mostPlayedByCourt.mid.label,
                          percentage: mostPlayedByCourt.mid.percentage,
                        }
                      : null
                  }
                  selected={selectedCourtRow === "mid"}
                  onSelect={() => handleCourtCardClick("mid")}
                  className="flex-1 min-h-0"
                />
                <MostPlayedShotCard
                  courtRow="back"
                  metric={
                    mostPlayedByCourt.back
                      ? {
                          label: mostPlayedByCourt.back.label,
                          percentage: mostPlayedByCourt.back.percentage,
                        }
                      : null
                  }
                  selected={selectedCourtRow === "back"}
                  onSelect={() => handleCourtCardClick("back")}
                  className="flex-1 min-h-0"
                />
              </div>
            </div>
          </div>

          {/* Middle row: outcomes per shot type bar chart */}
          <div className="frame relative z-10 rounded-xl p-5 h-[280px] flex flex-col">
            <h2 className="mb-3 text-xs font-semibold text-text-main shrink-0">
              Outcomes per Shot Type
            </h2>
            <div className="flex-1 min-h-0">
              {loading ? (
                <p className="flex items-center gap-2 text-xs text-text-soft">
                  <CircleNotchIcon
                    className="h-3.5 w-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Loading shots…
                </p>
              ) : (
                <AnalysisOutcomesChart shots={filteredShots} className="h-full" />
              )}
            </div>
          </div>

          {/* Bottom row: match timeline grid */}
          <div className="frame relative z-10 rounded-xl p-5">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-main">
              <CalendarBlankIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Match Timeline
            </h2>
            <MatchTimelineGrid matches={matches} />
          </div>
        </div>

        {/* Right (lg+): court visual, ~half space, no frame, drop shadow */}
        <div
          className="hidden lg:flex items-center justify-center py-6 pl-6"
          style={{ perspective: "800px" }}
        >
          <div
            className="w-full max-w-md flex justify-center"
            style={{
              filter: "drop-shadow(0 20px 25px rgba(0,0,0,0.25))",
            }}
            aria-hidden
          >
            <Court3D
              selectedZone={selectedZone}
              highlightedCourtRow={selectedZone == null ? selectedCourtRow : null}
              shots={playerFilteredShots}
              onZoneClick={handleZoneClick}
            />
          </div>
        </div>
      </div>

      {/* Mobile: court below content, no overlap */}
      <div
        className="lg:hidden flex justify-center py-8"
        style={{ perspective: "800px" }}
      >
        <div
          className="flex justify-center"
          style={{
            filter: "drop-shadow(0 20px 25px rgba(0,0,0,0.25))",
          }}
          aria-hidden
        >
          <Court3D
            selectedZone={selectedZone}
            highlightedCourtRow={selectedZone == null ? selectedCourtRow : null}
            shots={playerFilteredShots}
            onZoneClick={handleZoneClick}
          />
        </div>
      </div>
    </div>
  );
}
