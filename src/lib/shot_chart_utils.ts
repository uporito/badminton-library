import { shotTypeEnum, outcomeEnum, zoneEnum } from "@/db/schema";
import type { ShotType, Outcome, Side } from "@/db/schema";

/** Consistent display labels for shot types (used in legends and tooltips) */
export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  serve: "Serve",
  clear: "Clear",
  smash: "Smash",
  drop: "Drop",
  drive: "Drive",
  lift: "Lift",
  net: "Net",
  block: "Block",
};

/** Bright colors on white – one per shot type for consistent legend across charts */
export const SHOT_TYPE_COLORS: Record<ShotType, string> = {
  serve: "blue",
  clear: "cyan",
  smash: "rose",
  drop: "violet",
  drive: "amber",
  lift: "emerald",
  net: "pink",
  block: "slate",
};

/** Outcome colors: green = winner, red = error, neutral for neither */
export const OUTCOME_COLORS: Record<Outcome, string> = {
  winner: "green",
  error: "red",
  neither: "slate",
};

/** Ordered list of shot types for consistent legend and bar order */
export const SHOT_TYPE_ORDER: ShotType[] = [...shotTypeEnum];

/** Ordered outcomes for stacked bar (winner, error, neither) */
export const OUTCOME_ORDER: Outcome[] = ["winner", "error", "neither"];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  winner: "Winner",
  error: "Error",
  neither: "Neither",
};

/** Minimal shot shape used for aggregation (from API or RallyWithShots) */
export interface ShotForStats {
  shotType: ShotType;
  outcome: Outcome;
  player: Side;
  zoneFrom: string;
  zoneTo: string;
  zoneFromSide: Side;
  zoneToSide: Side;
}

/** Pie/donut data: shot distribution by type */
export function aggregateShotDistribution(
  shots: ShotForStats[]
): { shotType: string; count: number; label: string }[] {
  const counts = new Map<ShotType, number>();
  for (const t of shotTypeEnum) {
    counts.set(t, 0);
  }
  for (const s of shots) {
    counts.set(s.shotType, (counts.get(s.shotType) ?? 0) + 1);
  }
  return SHOT_TYPE_ORDER.map((shotType) => ({
    shotType,
    count: counts.get(shotType) ?? 0,
    label: SHOT_TYPE_LABELS[shotType],
  })).filter((row) => row.count > 0);
}

/** Stacked bar data: each row = shot type, columns = winner / error / neither */
export function aggregateOutcomesByShotType(
  shots: ShotForStats[]
): { shotType: string; label: string; winner: number; error: number; neither: number }[] {
  const map = new Map<
    ShotType,
    { winner: number; error: number; neither: number }
  >();
  for (const t of shotTypeEnum) {
    map.set(t, { winner: 0, error: 0, neither: 0 });
  }
  for (const s of shots) {
    const row = map.get(s.shotType)!;
    row[s.outcome]++;
  }
  return SHOT_TYPE_ORDER.map((shotType) => {
    const row = map.get(shotType)!;
    return {
      shotType,
      label: SHOT_TYPE_LABELS[shotType],
      winner: row.winner,
      error: row.error,
      neither: row.neither,
    };
  });
}

/** Zone index for 3x3 grid: row 0 = front, row 2 = back; col 0 = left, col 2 = right */
const ZONE_INDEX: Record<string, { row: number; col: number }> = {};
zoneEnum.forEach((z, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  ZONE_INDEX[z] = { row, col };
});

/** Count shots per zone (zoneFrom) for a given player. Returns 3x3 grid counts [row][col]. */
export function aggregateZoneCounts(
  shots: ShotForStats[],
  player: Side
): number[][] {
  const grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const s of shots) {
    if (s.player !== player) continue;
    const pos = ZONE_INDEX[s.zoneFrom];
    if (pos) grid[pos.row][pos.col]++;
  }
  return grid;
}

/** Count shots TO each zone on the given side (zoneToSide === side). Returns 3x3 grid [row][col]. */
export function aggregateZoneToCountsBySide(
  shots: ShotForStats[],
  side: Side
): number[][] {
  const grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const s of shots) {
    if (s.zoneToSide !== side) continue;
    const pos = ZONE_INDEX[s.zoneTo];
    if (pos) grid[pos.row][pos.col]++;
  }
  return grid;
}

/** Count shots FROM each zone on the given side (zoneFromSide === side). Returns 3x3 grid [row][col]. */
export function aggregateZoneFromCountsBySide(
  shots: ShotForStats[],
  side: Side
): number[][] {
  const grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const s of shots) {
    if (s.zoneFromSide !== side) continue;
    const pos = ZONE_INDEX[s.zoneFrom];
    if (pos) grid[pos.row][pos.col]++;
  }
  return grid;
}

/** Min and max count from a 3x3 grid (for heatmap scale) */
export function zoneCountRange(grid: number[][]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const row of grid) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
}
