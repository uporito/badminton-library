"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CircleNotchIcon,
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
  opponents: { id: number; name: string }[];
  partner: { id: number; name: string } | null;
  result: string | null;
  category: string | null;
  tags: string | null;
};

interface AnalysisDashboardProps {
  matches: MatchRow[];
  allTags: string[];
}

type AnalysisTab = "global" | "shot-patterns" | "shot-analysis";

const TABS: { id: AnalysisTab; label: string }[] = [
  { id: "global", label: "Global Analysis" },
  { id: "shot-patterns", label: "Shot Patterns" },
  { id: "shot-analysis", label: "Shot Analysis" },
];

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
      className={`relative rounded-lg px-4 py-3 flex flex-row items-center justify-between gap-4 min-h-0 text-left transition-colors outline-none hover:ring-2 hover:ring-accent focus-visible:ring-2 focus-visible:ring-accent ${className ?? ""}`}
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
        className="flex items-center gap-1.5 rounded-lg bg-ui-frame px-3 py-1.5 text-xs text-text-main hover:bg-ui-elevated transition-colors"
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
  { value: "me", label: "Shots by Me" },
  { value: "partner", label: "Shots by Partner" },
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
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Filter state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [selectedOpponents, setSelectedOpponents] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set(["me"]));

  const opponentOptions = useMemo<FilterOption[]>(() => {
    const unique = [
      ...new Set(
        matches.flatMap((m) => m.opponents.map((o) => o.name)).filter((n) => n.trim() !== ""),
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
      filtered = filtered.filter((m) =>
        m.opponents.some((o) => selectedOpponents.has(o.name)),
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

  const playerFilteredShots = useMemo(() => {
    if (selectedPlayers.size === PLAYER_OPTIONS.length) return shots;
    return shots.filter((s) => selectedPlayers.has(s.player));
  }, [shots, selectedPlayers]);

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
    <div className="relative w-full min-h-screen font-sans overflow-hidden">
      {/* ── 3-D court background — fills the entire page ── */}
      <Court3D
        selectedZone={selectedZone}
        highlightedCourtRow={selectedZone == null ? selectedCourtRow : null}
        shots={playerFilteredShots}
        onZoneClick={handleZoneClick}
        showHeatmap={showHeatmap}
        groundColor={isDark ? "#14141e" : "#f6f7fa"}
      />

      {/* ── Dashboard content — overlays the 3-D scene.
           No z-index on this wrapper so .frame backdrop-filter can blur the canvas below. ── */}
      <div className="relative flex flex-col pointer-events-none">
        {/* Nav bar with frosted glass */}
        <nav
          className="pointer-events-auto flex items-center justify-between gap-4 px-5 py-3 mb-4 flex-wrap backdrop-blur-xl bg-ui-bg/60"
          aria-label="Analysis sections"
        >
          <div className="flex gap-6">
            {TABS.map(({ id, label }) => (
              <div key={id} className="relative pb-3 -mb-3">
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
              selected={selectedPlayers}
              onToggle={(val) =>
                setSelectedPlayers((prev) => {
                  const next = new Set(prev);
                  if (next.has(val)) {
                    if (next.size > 1) next.delete(val);
                  } else {
                    next.add(val);
                  }
                  return next;
                })
              }
              minWidthText="Shots by Opponent"
              isOpen={openDropdown === "player"}
              onToggleOpen={() => toggleDropdown("player")}
            />

            {/* Heatmap toggle — inline with filters */}
            <button
              type="button"
              onClick={() => setShowHeatmap((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                showHeatmap
                  ? "bg-accent text-ui-bg"
                  : "bg-ui-frame text-text-soft hover:bg-ui-elevated hover:text-text-main"
              }`}
            >
              Heatmap
            </button>
          </div>
        </nav>

        {/* Panels — left-aligned on lg so the court peeks through on the right */}
        <div className="px-5 pb-8 lg:max-w-[58%] flex flex-col gap-6">
          {/* Top row: donut + most-played cards */}
          <div className="pointer-events-auto grid grid-cols-1 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-5">
            <div className="frame relative rounded-xl p-5 min-h-0 flex flex-col h-[260px]">
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
            <div className="flex flex-col gap-3 min-h-0 h-[260px]">
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

          {/* Outcomes chart */}
          <div className="pointer-events-auto frame relative rounded-xl p-5 h-[280px] flex flex-col">
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

        </div>
      </div>
    </div>
  );
}
