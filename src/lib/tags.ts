export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    // ignore malformed JSON
  }
  return [];
}

export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

export function getAllUniqueTags(rows: { tags: string | null }[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const tag of parseTags(row.tags)) {
      set.add(tag);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
