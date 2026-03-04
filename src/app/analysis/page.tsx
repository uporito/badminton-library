import { listMatches } from "@/lib/list_matches";
import { AnalysisDashboard } from "./analysis_dashboard";

export default function AnalysisPage() {
  const matches = listMatches();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <AnalysisDashboard matches={matches} />
    </div>
  );
}
