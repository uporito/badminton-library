import { notFound } from "next/navigation";
import { getMatchById } from "@/lib/get_match_by_id";
import { EditMatchForm } from "./edit_match_form";

interface EditMatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMatchPage({ params }: EditMatchPageProps) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId) || numId < 1) {
    notFound();
  }
  const result = getMatchById(numId);
  if (!result.ok) {
    notFound();
  }
  const match = result.data;

  return (
    <div className="min-h-screen font-sans">
      <h1 className="mb-4 text-xl font-semibold text-text-main">
        Edit match
      </h1>
      <EditMatchForm matchId={match.id} initialMatch={match} />
    </div>
  );
}
