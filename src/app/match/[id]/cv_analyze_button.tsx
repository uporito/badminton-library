"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CpuIcon, CircleNotchIcon } from "@phosphor-icons/react";
import {
  CourtCalibration,
  type CalibrationData,
} from "./court_calibration";

interface CvAnalyzeButtonProps {
  matchId: number;
  videoUrl: string;
}

type Status = "idle" | "loading" | "success" | "error";

const POLL_INTERVAL_MS = 3_000;

export function CvAnalyzeButton({ matchId, videoUrl }: CvAnalyzeButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleCalibrationChange = useCallback(
    (cal: CalibrationData | null) => {
      setCalibration(cal);
    },
    []
  );

  async function handleAnalyze() {
    setStatus("loading");
    setProgress(null);
    setProgressPct(null);
    setMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/matches/${matchId}/cv-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calibration }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.error ?? "Failed to start analysis");
        return;
      }

      const { job_id } = await res.json();
      await pollJob(job_id, controller.signal);
    } catch (e) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Network error");
    }
  }

  async function pollJob(jobId: string, signal: AbortSignal) {
    while (!signal.aborted) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const res = await fetch(
        `/api/matches/${matchId}/cv-analyze?jobId=${jobId}`,
        { signal }
      );

      if (!res.ok) {
        setStatus("error");
        setMessage("Failed to poll job status");
        return;
      }

      const job = await res.json();

      if (job.progress) setProgress(job.progress);
      if (job.progress_pct != null) setProgressPct(job.progress_pct);

      if (job.status === "completed") {
        setStatus("success");
        setProgress(null);
        setMessage(
          `CV analysis complete — ${job.result?.rally_count ?? 0} rallies, ` +
            `${job.result?.shot_count ?? 0} shots detected.`
        );
        router.refresh();
        return;
      }

      if (job.status === "failed") {
        setStatus("error");
        setProgress(null);
        setMessage(job.error ?? "Analysis failed");
        return;
      }
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Row 1: calibrate + show calibration */}
      <div className="flex items-center gap-2">
        <CourtCalibration
          videoUrl={videoUrl}
          matchId={matchId}
          initialCalibration={calibration}
          onCalibrationChange={handleCalibrationChange}
        />
      </div>

      {/* Row 2: CV analysis and status */}
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={status === "loading"}
          className="inline-flex w-48 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === "loading" ? (
            <CircleNotchIcon size={16} className="animate-spin" />
          ) : (
            <CpuIcon size={16} weight="fill" />
          )}
          {status === "loading" ? "Analyzing..." : "CV Analysis"}
        </button>

        {status === "loading" && progress && (
          <div className="flex flex-col items-end gap-1">
            <p className="text-right text-xs text-text-soft">{progress}</p>
            {progressPct != null && (
              <div className="h-1.5 w-36 overflow-hidden rounded-full bg-ui-elevated">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.round(progressPct * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {status === "success" && message && (
          <p className="text-right text-xs text-ui-success">{message}</p>
        )}

        {status === "error" && message && (
          <p className="max-w-xs text-right text-xs text-ui-error">{message}</p>
        )}
      </div>
    </div>
  );
}
