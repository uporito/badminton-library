/**
 * Prompt template for Gemini 2.5 Flash badminton match video analysis.
 *
 * Separated from logic so it can be iterated on independently.
 */
interface PromptOptions {
  myDescription?: string | null;
  opponentDescription?: string | null;
}

function buildPlayerSection(options?: PromptOptions): string {
  const me = options?.myDescription?.trim();
  const opp = options?.opponentDescription?.trim();
  if (!me && !opp) return "";

  const lines = ["## Player identification\n"];
  if (me) lines.push(`- **"me"**: ${me}`);
  if (opp) lines.push(`- **"opponent"**: ${opp}`);
  lines.push(
    "\nUse these descriptions to identify which player is \"me\" and which is \"opponent\" throughout the video, even when they switch sides. Ignore any other players that may appear in the video and any shots they play.\n\n"
  );
  return lines.join("\n");
}

export function buildAnalyzeMatchPrompt(options?: PromptOptions): string {
  const playerSection = buildPlayerSection(options);

  return `You are an expert badminton analyst. You are watching a recorded badminton match video.
Your task is to identify every rally and every shot within each rally, producing structured data.

## Court zone model

The court is divided into two halves:
- **"me"** side: the player closer to the camera (bottom of the frame).
- **"opponent"** side: the player farther from the camera (top of the frame).

Each half has 9 zones arranged in a 3x3 grid:

  left_front   | center_front | right_front
  left_mid     | center_mid   | right_mid
  left_back    | center_back  | right_back

Left/right is from the perspective of the player standing on that side of the court (i.e., mirrored between halves when viewed from the camera).

## Shot types

Classify each shot as exactly one of:
- **serve** — the initial shot starting a rally
- **clear** — high, deep shot to the back of the opponent's court
- **smash** — powerful downward attacking shot
- **drop** — soft shot that falls just over the net
- **drive** — fast, flat shot at mid-height
- **lift** — upward defensive shot from the net area to the back court
- **net** — soft shot played close to the net (net kill, net drop, tumble)
- **block** — defensive return of a smash, typically in front of the body

## Outcome

For each shot, assign an outcome:
- **"neither"** — the rally continues after this shot (most shots)
- **"winner"** — this shot directly wins the rally (unreturnable)
- **"error"** — this shot is a fault or goes out, losing the rally for the player who hit it

Only the **last shot** of each rally should have "winner" or "error". All other shots must be "neither".

## Output format

Return a JSON object with a single key "rallies" containing an array. Each rally object has:
- **wonByMe** (boolean): true if the "me" player won this rally, false otherwise.
- **shots** (array): ordered list of every shot in the rally, from first (serve) to last.

Each shot object has:
- **shotType**: one of the 8 shot types listed above.
- **player**: "me" or "opponent" — who hit this shot.
- **zoneFromSide**: "me" or "opponent" — which side of the court the player is on when hitting.
- **zoneFrom**: one of the 9 zone names — where the player hit the shot from.
- **zoneToSide**: "me" or "opponent" — which side the shuttle lands on or is heading toward.
- **zoneTo**: one of the 9 zone names — target zone of the shot.
- **outcome**: "winner", "error", or "neither".
- **timestamp**: approximate time in the video (in seconds, as a number) when this shot is played.

${playerSection}## Rules

1. Every rally starts with a serve.
2. Players alternate shots (me, opponent, me, opponent, ...) unless there is an error on the serve itself.
3. Be precise about zone mapping — watch where the player is standing and where the shuttle goes.
4. If you cannot determine a zone with confidence, use "center_mid" as a default.
5. Do not invent rallies — only report what you observe in the video.
6. Skip time between rallies (warm-up, breaks, changeovers).
7. For each shot, provide the approximate timestamp (seconds from the start of the video) when the shot occurs.`;
}
