import { listMatches } from "@/lib/list_matches";
import { groupMatchesForLibrary } from "@/lib/group_matches_for_library";
import type { ListMatchesCategoryFilter, ListMatchesSort } from "@/lib/list_matches";
import { MatchCard } from "./match_card";
import Link from "next/link";

const CATEGORY_OPTIONS: { value: ListMatchesCategoryFilter; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Singles", label: "Singles" },
  { value: "Doubles", label: "Doubles" },
  { value: "Mixed", label: "Mixed" },
];

const SORT_OPTIONS: { value: ListMatchesSort; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "opponent", label: "Opponent" },
];

function buildLibraryUrl(params: {
  category?: ListMatchesCategoryFilter;
  sort?: ListMatchesSort;
}): string {
  const sp = new URLSearchParams();
  if (params.category && params.category !== "All") sp.set("category", params.category);
  if (params.sort) sp.set("sort", params.sort);
  const q = sp.toString();
  return q ? `/?${q}` : "/";
}

interface HomeProps {
  searchParams: Promise<{ category?: string; sort?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const category = (params.category as ListMatchesCategoryFilter | undefined) ?? "All";
  const sort = (params.sort as ListMatchesSort | undefined) ?? "date";

  const validCategory: ListMatchesCategoryFilter =
    CATEGORY_OPTIONS.some((c) => c.value === category) ? category : "All";
  const validSort: ListMatchesSort =
    SORT_OPTIONS.some((s) => s.value === sort) ? sort : "date";

  const matches = listMatches({
    category: validCategory,
    sort: validSort,
  });
  const sections = groupMatchesForLibrary(matches, validSort);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          My Matches
        </h1>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <span className="mr-2 self-center px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Category
            </span>
            {CATEGORY_OPTIONS.map((c) => (
              <Link
                key={c.value}
                href={buildLibraryUrl({ category: c.value, sort: validSort })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  validCategory === c.value
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <div className="flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <span className="mr-2 self-center px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Sort
            </span>
            {SORT_OPTIONS.map((s) => (
              <Link
                key={s.value}
                href={buildLibraryUrl({ category: validCategory, sort: s.value })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  validSort === s.value
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              No matches yet. Add matches from the Database page.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.label}>
                <h2 className="mb-3 border-b border-zinc-200 pb-2 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  {section.label}
                </h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.matches.map((match) => (
                    <li key={match.id}>
                      <MatchCard match={match} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
