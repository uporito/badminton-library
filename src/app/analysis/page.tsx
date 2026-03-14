import { listMatches } from "@/lib/list_matches";
import { getAllUniqueTags } from "@/lib/tags";
import { AnalysisDashboard } from "./analysis_dashboard";

export default function AnalysisPage() {
  const matches = listMatches();
  const allTags = getAllUniqueTags(matches);

  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] relative font-sans overflow-hidden min-h-screen">
      <AnalysisDashboard matches={matches} allTags={allTags} />
    </div>
  );
}
