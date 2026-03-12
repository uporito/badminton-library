"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface AcceptAiShotsButtonProps {
  matchId: number;
  aiSuggestedCount: number;
}

export function AcceptAiShotsButton({
  matchId,
  aiSuggestedCount,
}: AcceptAiShotsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (aiSuggestedCount <= 0) return null;

  async function handleConfirmAll() {
    const res = await fetch(`/api/matches/${matchId}/shots`, {
      method: "PATCH",
    });
    if (!res.ok) {
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleDiscardAll() {
    const res = await fetch(`/api/matches/${matchId}/shots`, {
      method: "DELETE",
    });
    if (!res.ok) {
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex w-full gap-2">
      <button
        type="button"
        onClick={handleDiscardAll}
        disabled={isPending}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ui-error/40 bg-ui-error/10 px-3 py-2 text-sm font-medium text-ui-error hover:bg-ui-error/15 disabled:opacity-50"
      >
        Discard AI shots
      </button>
      <button
        type="button"
        onClick={handleConfirmAll}
        disabled={isPending}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ui-success/40 bg-ui-success/10 px-3 py-2 text-sm font-medium text-ui-success hover:bg-ui-success/15 disabled:opacity-50"
      >
        Accept AI shots
        {aiSuggestedCount > 0 && (
          <span className="ml-1 text-xs font-normal opacity-80">
            ({aiSuggestedCount})
          </span>
        )}
      </button>
    </div>
  );
}

