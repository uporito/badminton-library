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

  const aiSuggestedCount = initialRallies.reduce(
    (sum, r) => sum + r.shots.filter((s) => s.source === "ai_suggested").length,
    0
  );

  async function handleConfirmAll() {
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/shots`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to confirm shots");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <section className="frame rounded-xl p-4">
      <h2 className="mb-4 text-sm font-semibold text-text-main">
        Input Shots
      </h2>

      <div className="space-y-4">
        {aiSuggestedCount > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2">
            <p className="text-xs text-accent">
              <span className="font-semibold">{aiSuggestedCount}</span> AI-suggested shot{aiSuggestedCount !== 1 ? "s" : ""} pending review
            </p>
            <button
              type="button"
              onClick={handleConfirmAll}
              disabled={isPending}
              className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Confirm all
            </button>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-text-soft">
            Current rally
            {currentRallyNumber !== null ? (
              <span className="ml-1.5 font-normal text-text-main">
                — Rally #{currentRallyNumber}
              </span>
            ) : (
              <span className="ml-1.5 font-normal text-text-soft">
                — None
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStartNewRally}
              disabled={isPending}
              className="rounded bg-ui-elevated-more px-3 py-1.5 text-sm text-foreground hover:opacity-90 disabled:opacity-50"
            >
              Start new rally
            </button>
            <span className="text-sm font-medium tabular-nums text-text-main">
              Me {myPoints} – {opponentPoints} Opponent
            </span>
          </div>
        </div>

        <div className="flex items-stretch gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="mb-2 text-xs font-medium text-text-soft">
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
                      ? "bg-ui-elevated-more text-foreground"
                      : "bg-ui-elevated text-foreground hover:bg-ui-elevated-more"
                  }`}
                >
                  {SHOT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="mb-2 text-xs font-medium text-text-soft">
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
          <p className="mb-2 text-xs font-medium text-text-soft">
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
                    ? "bg-ui-elevated-more text-foreground"
                    : "bg-ui-elevated text-foreground hover:bg-ui-elevated-more"
                }`}
              >
                {OUTCOME_LABELS[o]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-text-soft">
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
                    ? "bg-ui-elevated-more text-foreground"
                    : "bg-ui-elevated text-foreground hover:bg-ui-elevated-more"
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
            className="rounded bg-ui-success px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Add shot
          </button>
          <button
            type="button"
            onClick={handleClearAllShots}
            disabled={isPending || !initialRallies.length}
            className="rounded border border-ui-elevated-more bg-ui-elevated px-3 py-2 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-50"
          >
            Clear all shots
          </button>
        </div>
      </div>
    </section>
  );
}
