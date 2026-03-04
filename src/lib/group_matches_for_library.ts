import type { MatchRow } from "@/lib/list_matches";
import type { ListMatchesSort } from "@/lib/list_matches";

const NO_DATE_LABEL = "No date";
const NO_OPPONENT_LABEL = "No opponent";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  return `${monthName} ${year}`;
}

export interface LibrarySection {
  label: string;
  matches: MatchRow[];
}

export function groupMatchesForLibrary(
  matches: MatchRow[],
  sort: ListMatchesSort
): LibrarySection[] {
  if (sort === "date") {
    const byMonth = new Map<string, MatchRow[]>();
    for (const m of matches) {
      const key = m.date
        ? (m.date.includes("-") ? m.date.slice(0, 7) : m.date)
        : NO_DATE_LABEL;
      const list = byMonth.get(key) ?? [];
      list.push(m);
      byMonth.set(key, list);
    }
    const sections: LibrarySection[] = [];
    const sortedKeys = Array.from(byMonth.keys()).sort((a, b) => {
      if (a === NO_DATE_LABEL) return 1;
      if (b === NO_DATE_LABEL) return -1;
      return b.localeCompare(a);
    });
    for (const key of sortedKeys) {
      const label = key === NO_DATE_LABEL ? NO_DATE_LABEL : formatMonthLabel(key);
      sections.push({ label, matches: byMonth.get(key) ?? [] });
    }
    return sections;
  }

  const byOpponent = new Map<string, MatchRow[]>();
  for (const m of matches) {
    const key = m.opponent?.trim() ? m.opponent : NO_OPPONENT_LABEL;
    const list = byOpponent.get(key) ?? [];
    list.push(m);
    byOpponent.set(key, list);
  }
  const sortedKeys = Array.from(byOpponent.keys()).sort((a, b) => {
    if (a === NO_OPPONENT_LABEL) return 1;
    if (b === NO_OPPONENT_LABEL) return -1;
    return a.localeCompare(b);
  });
  return sortedKeys.map((label) => ({
    label,
    matches: byOpponent.get(label) ?? [],
  }));
}
