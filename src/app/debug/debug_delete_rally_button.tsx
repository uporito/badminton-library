"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface DeleteRallyButtonProps {
  matchId: number;
  rallyId: number;
}

export function DeleteRallyButton({ matchId, rallyId }: DeleteRallyButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    const res = await fetch(`/api/matches/${matchId}/rallies/${rallyId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed");
      setConfirming(false);
      return;
    }
    setConfirming(false);
    startTransition(() => router.refresh());
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded bg-ui-error px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded bg-ui-elevated px-2 py-1 text-xs text-white hover:opacity-90"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={isPending}
      className="rounded bg-ui-error px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
    >
      Delete rally
    </button>
  );
}
