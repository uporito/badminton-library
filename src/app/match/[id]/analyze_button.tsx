"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon, CircleNotchIcon } from "@phosphor-icons/react";

interface AnalyzeButtonProps {
  matchId: number;
}

interface NdjsonEvent {
  type: "progress" | "result" | "error";
  message?: string;
  error?: string;
  detail?: string;
  rallyCount?: number;
  shotCount?: number;
}

export function AnalyzeButton({ matchId }: AnalyzeButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleAnalyze() {
    setState("loading");
    setProgress(null);
    setMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/matches/${matchId}/analyze`, {
        method: "POST",
        signal: controller.signal,
      });

      if (!res.body) {
        const data = await res.json().catch(() => ({}));
        setState("error");
        setMessage(data.detail ?? data.error ?? "Analysis failed");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event: NdjsonEvent = JSON.parse(line);
            if (event.type === "progress" && event.message) {
              setProgress(event.message);
            } else if (event.type === "result") {
              finished = true;
              setState("success");
              setProgress(null);
              setMessage(
                `Analysis complete — ${event.rallyCount} rallies, ${event.shotCount} shots detected.`
              );
              router.refresh();
            } else if (event.type === "error") {
              finished = true;
              setState("error");
              setProgress(null);
              setMessage(event.detail ?? event.error ?? "Analysis failed");
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (!finished) {
        setState("error");
        setProgress(null);
        setMessage("Stream ended without a result.");
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      setState("error");
      setProgress(null);
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
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={state === "loading"}
        className="inline-flex w-44 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "loading" ? (
          <CircleNotchIcon size={16} className="animate-spin" />
        ) : (
          <SparkleIcon size={16} weight="fill" />
        )}
        {state === "loading" ? "Analyzing video…" : "Analyze with AI"}
      </button>

      {state === "loading" && progress && (
        <p className="text-right text-xs text-text-soft">{progress}</p>
      )}

      {state === "success" && message && (
        <p className="text-right text-xs text-ui-success">{message}</p>
      )}

      {state === "error" && message && (
        <p className="text-right text-xs text-ui-error">{message}</p>
      )}
    </div>
  );
}
