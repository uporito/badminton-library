import { listMatches } from "@/lib/list_matches";
import { AnalysisDashboard } from "./analysis_dashboard";

export default function AnalysisPage() {
  const matches = listMatches();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Analysis
        </h1>
        <AnalysisDashboard matches={matches} />
      </div>
    </div>
  );
}
