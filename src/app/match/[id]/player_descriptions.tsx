"use client";

import { useState, useRef } from "react";

interface PlayerDescriptionsProps {
  matchId: number;
  initialMyDescription: string;
  initialOpponentDescription: string;
}

export function PlayerDescriptions({
  matchId,
  initialMyDescription,
  initialOpponentDescription,
}: PlayerDescriptionsProps) {
  const [myDesc, setMyDesc] = useState(initialMyDescription);
  const [oppDesc, setOppDesc] = useState(initialOpponentDescription);
  const lastSaved = useRef({ my: initialMyDescription, opp: initialOpponentDescription });

  async function save(field: "myDescription" | "opponentDescription", value: string) {
    const key = field === "myDescription" ? "my" : "opp";
    const trimmed = value.trim();
    if (trimmed === lastSaved.current[key]) return;
    lastSaved.current[key] = trimmed;

    await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: trimmed || null }),
    }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-0.5">
        <span className="text-text-soft text-sm">
          My description <span className="text-text-soft/60">(optional)</span>
        </span>
        <input
          type="text"
          value={myDesc}
          onChange={(e) => setMyDesc(e.target.value)}
          onBlur={() => save("myDescription", myDesc)}
          placeholder="e.g. wearing red shirt, left-handed"
          className="rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main placeholder:text-text-soft/50 focus:outline-none focus:ring-1 focus:ring-ui-elevated-more"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-text-soft text-sm">
          Opponent description <span className="text-text-soft/60">(optional)</span>
        </span>
        <input
          type="text"
          value={oppDesc}
          onChange={(e) => setOppDesc(e.target.value)}
          onBlur={() => save("opponentDescription", oppDesc)}
          placeholder="e.g. taller, wearing blue shirt"
          className="rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main placeholder:text-text-soft/50 focus:outline-none focus:ring-1 focus:ring-ui-elevated-more"
        />
      </label>
    </div>
  );
}
