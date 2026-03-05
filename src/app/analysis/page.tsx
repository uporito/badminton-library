import { listMatches } from "@/lib/list_matches";
import { AnalysisDashboard } from "./analysis_dashboard";

export default function AnalysisPage() {
  const matches = listMatches();

  return (
    <div className="min-h-screen font-sans">
      <AnalysisDashboard matches={matches} />
    </div>
  );
}
