import { listMatches } from "@/lib/list_matches";
import { getAllUniqueTags } from "@/lib/tags";
import { AnalysisDashboard } from "./analysis_dashboard";

export default function AnalysisPage() {
  const matches = listMatches();
  const allTags = getAllUniqueTags(matches);

  return (
    <div className="min-h-screen font-sans">
      <AnalysisDashboard matches={matches} allTags={allTags} />
    </div>
  );
}
