import { listMatches } from "@/lib/list_matches";
import { MatchCard } from "./match_card";
import { AddMatchForm } from "./add_match_form";
import Link from "next/link";

export default function Home() {
  const matches = listMatches({ sort: "createdAt" });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Match library
          </h1>
          <Link
            href="/debug"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Debug: DB &amp; videos
          </Link>
        </div>
        <div className="mb-6">
          <AddMatchForm />
        </div>
        {matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              No matches yet. Add one above (title + path relative to VIDEO_ROOT).
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <li key={match.id}>
                <MatchCard match={match} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
