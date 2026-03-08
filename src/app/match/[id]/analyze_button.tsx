"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon, CircleNotchIcon } from "@phosphor-icons/react";

interface AnalyzeButtonProps {
  matchId: number;
}

export function AnalyzeButton({ matchId }: AnalyzeButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleAnalyze() {
    setState("loading");
    setMessage(null);

    try {
      const res = await fetch(`/api/matches/${matchId}/analyze`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.detail ?? data.error ?? "Analysis failed");
        return;
      }

      setState("success");
      setMessage(
        `Analysis complete — ${data.rallyCount} rallies, ${data.shotCount} shots detected.`
      );
      router.refresh();
    } catch (e) {
      setState("error");
      const msg = e instanceof Error ? e.message : "Network error";
      const isFetchFailed =
        msg.toLowerCase().includes("fetch failed") ||
        msg.toLowerCase().includes("network error");
      setMessage(
        isFetchFailed
          ? "Request failed (connection lost or timeout). For long videos, analysis can take 5+ minutes — check the server terminal to see how far it got."
          : msg
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "loading" ? (
          <CircleNotchIcon size={16} className="animate-spin" />
        ) : (
          <SparkleIcon size={16} weight="fill" />
        )}
        {state === "loading" ? "Analyzing video…" : "Analyze with AI"}
      </button>

      {state === "loading" && (
        <p className="text-xs text-text-soft">
          Uploading video and running analysis. This may take 1–3 minutes.
        </p>
      )}

      {state === "success" && message && (
        <p className="text-xs text-ui-success">{message}</p>
      )}

      {state === "error" && message && (
        <p className="text-xs text-ui-error">{message}</p>
      )}
    </div>
  );
}
