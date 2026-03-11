import { shotTypeEnum, outcomeEnum, zoneEnum } from "@/db/schema";
import type { ShotType, Outcome, Side, Zone, ShotPlayer } from "@/db/schema";

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

/** Design-system hex colors per shot type (align with globals.css) */
export const SHOT_TYPE_HEX: Record<ShotType, string> = {
  serve: "#455DDC",
  clear: "#FF862E",
  smash: "#F73463",
  drop: "#00BFA5",
  drive: "#9646EF",
  lift: "#F9A826",
  net: "#2E7D32",
  block: "#5C6BC0",
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
  player: ShotPlayer;
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

/**
 * Zone index for 3x3 grid: row 0 = front, row 2 = back; col 0 = left, col 2 = right.
 * zoneEnum is grouped by side (left_*, center_*, right_*), so depth cycles within each
 * group of 3: row = i % 3 (front/mid/back), col = floor(i / 3) (left/center/right).
 */
const ZONE_INDEX: Record<string, { row: number; col: number }> = {};
zoneEnum.forEach((z, i) => {
  const row = i % 3;
  const col = Math.floor(i / 3);
  ZONE_INDEX[z] = { row, col };
});

/** Count shots per zone (zoneFrom) for a given player. Returns 3x3 grid counts [row][col]. */
export function aggregateZoneCounts(
  shots: ShotForStats[],
  player: ShotPlayer
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

/** Court row: front = row 0, mid = row 1, back = row 2 */
export type CourtRow = "front" | "mid" | "back";

const ROW_TO_COURT: CourtRow[] = ["front", "mid", "back"];

export interface MostPlayedFromCourt {
  shotType: ShotType;
  label: string;
  percentage: number;
}

/**
 * For each court row (front / mid / back), find the most played shot type and its share.
 * Uses zoneFrom: row 0 = front, row 1 = mid, row 2 = back.
 */
export function getMostPlayedShotByCourt(
  shots: ShotForStats[]
): Record<CourtRow, MostPlayedFromCourt | null> {
  const byCourt: Record<
    CourtRow,
    { total: number; byType: Map<ShotType, number> }
  > = {
    front: { total: 0, byType: new Map() },
    mid: { total: 0, byType: new Map() },
    back: { total: 0, byType: new Map() },
  };

  for (const s of shots) {
    const pos = ZONE_INDEX[s.zoneFrom];
    if (!pos) continue;
    const court = ROW_TO_COURT[pos.row] as CourtRow;
    const bag = byCourt[court];
    bag.total++;
    bag.byType.set(s.shotType, (bag.byType.get(s.shotType) ?? 0) + 1);
  }

  const result: Record<CourtRow, MostPlayedFromCourt | null> = {
    front: null,
    mid: null,
    back: null,
  };

  for (const court of ROW_TO_COURT) {
    const { total, byType } = byCourt[court];
    if (total === 0) continue;
    let maxCount = 0;
    let bestType: ShotType | null = null;
    byType.forEach((count, shotType) => {
      if (count > maxCount) {
        maxCount = count;
        bestType = shotType;
      }
    });
    if (bestType != null) {
      result[court] = {
        shotType: bestType,
        label: SHOT_TYPE_LABELS[bestType],
        percentage: Math.round((maxCount / total) * 100),
      };
    }
  }

  return result;
}

/**
 * Filter shots to those played from a specific zone+side.
 * Pass null to return all shots (no filter).
 */
export function filterShotsByZone(
  shots: ShotForStats[],
  zone: { side: Side; zone: Zone } | null
): ShotForStats[] {
  if (zone == null) return shots;
  return shots.filter(
    (s) => s.zoneFrom === zone.zone && s.zoneFromSide === zone.side
  );
}

/**
 * Filter shots to those from a given court row (zoneFrom).
 * Pass null to return all shots (no filter).
 */
export function filterShotsByCourtRow(
  shots: ShotForStats[],
  courtRow: CourtRow | null
): ShotForStats[] {
  if (courtRow == null) return shots;
  const rowIndex = ROW_TO_COURT.indexOf(courtRow);
  if (rowIndex < 0) return shots;
  return shots.filter((s) => {
    const pos = ZONE_INDEX[s.zoneFrom];
    return pos && pos.row === rowIndex;
  });
}
