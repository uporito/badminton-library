"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RallyWithShots } from "@/lib/get_rallies_by_match_id";
import {
  zoneEnum,
  shotTypeEnum,
  outcomeEnum,
  sideEnum,
} from "@/db/schema";
import type { Zone, Side } from "@/db/schema";
import { CourtZoneGrid } from "./court_zone_grid";

const SHOT_TYPE_LABELS: Record<(typeof shotTypeEnum)[number], string> = {
  serve: "Serve",
  clear: "Clear",
  smash: "Smash",
  drop: "Drop",
  drive: "Drive",
  lift: "Lift",
  net: "Net",
  block: "Block",
};

const OUTCOME_LABELS: Record<(typeof outcomeEnum)[number], string> = {
  winner: "Winner",
  error: "Error",
  neither: "Neither",
};

const SIDE_LABELS: Record<(typeof sideEnum)[number], string> = {
  me: "Me",
  opponent: "Opponent",
};

interface InputShotsPanelProps {
  matchId: number;
  initialRallies: RallyWithShots[];
}

export function InputShotsPanel({
  matchId,
  initialRallies,
}: InputShotsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentRallyId, setCurrentRallyId] = useState<number | null>(null);
  const [shotType, setShotType] = useState<(typeof shotTypeEnum)[number]>(
    "smash"
  );
  const [zoneFrom, setZoneFrom] = useState<{
    side: Side;
    zone: Zone;
  } | null>(null);
  const [zoneTo, setZoneTo] = useState<{ side: Side; zone: Zone } | null>(null);
  const [zoneStep, setZoneStep] = useState<"from" | "to">("from");
  const [outcome, setOutcome] = useState<(typeof outcomeEnum)[number]>(
    "winner"
  );
  const [player, setPlayer] = useState<(typeof sideEnum)[number]>("me");
  const [error, setError] = useState<string | null>(null);

  async function handleStartNewRally() {
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/rallies`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create rally");
      return;
    }
    const data = await res.json();
    setCurrentRallyId(data.id);
    startTransition(() => router.refresh());
  }

  async function handleAddShot() {
    if (!zoneFrom || !zoneTo) {
      setError("Select from and to zones");
      return;
    }
    setError(null);
    const body = {
      rallyId: currentRallyId ?? undefined,
      shotType,
      zoneFromSide: zoneFrom.side,
      zoneFrom: zoneFrom.zone,
      zoneToSide: zoneTo.side,
      zoneTo: zoneTo.zone,
      outcome,
      player,
    };
    const res = await fetch(`/api/matches/${matchId}/shots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add shot");
      return;
    }
    const data = await res.json();
    if (data.rallyCreated?.id) {
      setCurrentRallyId(data.rallyCreated.id);
    }
    setZoneFrom(null);
    setZoneTo(null);
    setZoneStep("from");

    if (outcome === "winner" || outcome === "error") {
      const newRallyRes = await fetch(`/api/matches/${matchId}/rallies`, {
        method: "POST",
      });
      if (newRallyRes.ok) {
        const newRallyData = await newRallyRes.json();
        setCurrentRallyId(newRallyData.id);
      }
    }

    startTransition(() => router.refresh());
  }

  function handleZoneClick(side: Side, zone: Zone) {
    if (zoneStep === "from") {
      setZoneFrom({ side, zone });
      setZoneTo(null);
      setZoneStep("to");
    } else {
      setZoneTo({ side, zone });
    }
  }

  async function handleClearAllShots() {
    if (
      !initialRallies.length ||
      !confirm("Clear all shots and rallies for this match? This cannot be undone.")
    ) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/rallies`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to clear shots");
      return;
    }
    setCurrentRallyId(null);
    setZoneFrom(null);
    setZoneTo(null);
    setZoneStep("from");
    startTransition(() => router.refresh());
  }

  const rallyIdToNumber = new Map(
    initialRallies.map((r, i) => [r.id, i + 1])
  );
  const currentRallyNumber =
    currentRallyId !== null
      ? rallyIdToNumber.get(currentRallyId) ?? initialRallies.length + 1
      : null;

  const myPoints = initialRallies.filter((r) => r.wonByMe === true).length;
  const opponentPoints = initialRallies.filter(
    (r) => r.wonByMe === false
  ).length;

  return (
    <section className="frame-glass rounded-xl p-4">
      <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Input Shots
      </h2>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Current rally
            {currentRallyNumber !== null ? (
              <span className="ml-1.5 font-normal text-zinc-600 dark:text-zinc-300">
                — Rally #{currentRallyNumber}
              </span>
            ) : (
              <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
                — None
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStartNewRally}
              disabled={isPending}
              className="rounded bg-zinc-600 px-3 py-1.5 text-sm text-white hover:bg-zinc-500 disabled:opacity-50"
            >
              Start new rally
            </button>
            <span className="text-sm font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
              Me {myPoints} – {opponentPoints} Opponent
            </span>
          </div>
        </div>

        <div className="flex items-stretch gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Shot type
            </p>
            <div className="flex flex-col gap-1">
              {shotTypeEnum.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setShotType(t)}
                  className={`w-full rounded px-2 py-1 text-center text-sm ${
                    shotType === t
                      ? "bg-zinc-700 text-white dark:bg-zinc-500"
                      : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                  }`}
                >
                  {SHOT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Shot From/To
            </p>
            <CourtZoneGrid
              zoneFrom={zoneFrom}
              zoneTo={zoneTo}
              onZoneClick={handleZoneClick}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Outcome
          </p>
          <div className="flex flex-wrap gap-1.5">
            {outcomeEnum.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(o)}
                className={`rounded px-2 py-1 text-sm ${
                  outcome === o
                    ? "bg-zinc-700 text-white dark:bg-zinc-500"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                }`}
              >
                {OUTCOME_LABELS[o]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Player
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sideEnum.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlayer(s)}
                className={`rounded px-2 py-1 text-sm ${
                  player === s
                    ? "bg-zinc-700 text-white dark:bg-zinc-500"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                }`}
              >
                {SIDE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddShot}
            disabled={isPending || !zoneFrom || !zoneTo}
            className="rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            Add shot
          </button>
          <button
            type="button"
            onClick={handleClearAllShots}
            disabled={isPending || !initialRallies.length}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Clear all shots
          </button>
        </div>
      </div>
    </section>
  );
}
