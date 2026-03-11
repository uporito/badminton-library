"use client";

import { useRouter } from "next/navigation";
import { MatchForm } from "@/app/match_form";
import type { MatchRow } from "@/lib/get_match_by_id";

interface EditMatchFormProps {
  matchId: number;
  initialMatch: MatchRow;
}

export function EditMatchForm({ matchId, initialMatch }: EditMatchFormProps) {
  const router = useRouter();

  return (
    <MatchForm
      mode="edit"
      initialMatch={initialMatch}
      onSuccess={() => router.push(`/match/${matchId}`)}
    />
  );
}
