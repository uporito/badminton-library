import { listMatches } from "@/lib/list_matches";
import { MatchCard } from "./match_card";
import { AddMatchForm } from "./add_match_form";

export default function Home() {
  const matches = listMatches({ sort: "createdAt" });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Match library
        </h1>
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
