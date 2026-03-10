import { FilmStripIcon, TrayIcon } from "@phosphor-icons/react/ssr";
import { listMatches } from "@/lib/list_matches";
import { groupMatchesForLibrary } from "@/lib/group_matches_for_library";
import type { ListMatchesCategoryFilter, ListMatchesSort } from "@/lib/list_matches";
import { MatchCard } from "./match_card";
import { TagFilter } from "./tag_filter";
import { ImportPanel } from "./import_panel";
import { isGDriveConfigured } from "@/lib/gdrive";
import { thumbnailExists } from "@/lib/thumbnails";
import { isYouTubeConfigured } from "@/lib/youtube";
import { getAllUniqueTags, parseTags } from "@/lib/tags";
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
  searchParams: Promise<{ category?: string; sort?: string; tags?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const category = (params.category as ListMatchesCategoryFilter | undefined) ?? "All";
  const sort = (params.sort as ListMatchesSort | undefined) ?? "date";

  const validCategory: ListMatchesCategoryFilter =
    CATEGORY_OPTIONS.some((c) => c.value === category) ? category : "All";
  const validSort: ListMatchesSort =
    SORT_OPTIONS.some((s) => s.value === sort) ? sort : "date";

  const allMatches = listMatches({
    category: validCategory,
    sort: validSort,
  });

  const allTags = getAllUniqueTags(allMatches);

  const activeTags = params.tags?.split(",").filter(Boolean) ?? [];
  const matches =
    activeTags.length > 0
      ? allMatches.filter((m) => {
          const matchTags = parseTags(m.tags);
          return activeTags.some((t) => matchTags.includes(t));
        })
      : allMatches;

  const sections = groupMatchesForLibrary(matches, validSort);

  const gdriveConfigured = isGDriveConfigured();
  const youtubeConfigured = isYouTubeConfigured();
  const existingMatches = allMatches.map((m) => ({
    id: m.id,
    videoPath: m.videoPath,
    videoSource: m.videoSource ?? "local",
  }));

  return (
    <div className="min-h-screen font-sans">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-text-main">
          <FilmStripIcon className="h-7 w-7 shrink-0" aria-hidden />
          My Matches
        </h1>

        <div className="mb-6">
          <ImportPanel
            gdriveConfigured={gdriveConfigured}
            youtubeConfigured={youtubeConfigured}
            existingMatches={existingMatches}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="frame flex rounded-xl p-1">
            <span className="mr-2 self-center px-2 text-xs font-medium text-text-soft">
              Category
            </span>
            {CATEGORY_OPTIONS.map((c) => (
              <Link
                key={c.value}
                href={buildLibraryUrl({ category: c.value, sort: validSort })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  validCategory === c.value
                    ? "bg-ui-elevated-more text-foreground"
                    : "text-text-soft hover:bg-ui-elevated"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <div className="frame flex rounded-xl p-1">
            <span className="mr-2 self-center px-2 text-xs font-medium text-text-soft">
              Sort by
            </span>
            {SORT_OPTIONS.map((s) => (
              <Link
                key={s.value}
                href={buildLibraryUrl({ category: validCategory, sort: s.value })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  validSort === s.value
                    ? "bg-ui-elevated-more text-foreground"
                    : "text-text-soft hover:bg-ui-elevated"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="mb-4">
            <TagFilter allTags={allTags} />
          </div>
        )}

        {matches.length === 0 ? (
          <div className="frame flex flex-col items-center gap-3 rounded-xl p-12 text-center">
            <TrayIcon
              className="h-12 w-12 text-text-soft"
              aria-hidden
            />
            <p className="text-text-soft">
              {activeTags.length > 0
                ? "No matches found with the selected tags."
                : "No matches yet. Add matches from the Database page."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.label}>
                <h2 className="mb-3 border-b border-ui-elevated-more pb-2 text-sm font-semibold text-text-main">
                  {section.label}
                </h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.matches.map((match) => (
                    <li key={match.id}>
                      <MatchCard
                        match={match}
                        hasThumbnail={
                          (match.videoSource === "gdrive" ||
                            match.videoSource === "youtube") &&
                          thumbnailExists(match.videoSource, match.videoPath)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
    </div>
  );
}
