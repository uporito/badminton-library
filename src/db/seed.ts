import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { matches, matchRally, matchShots } from "./schema.js";

const sqlite = new Database("./data/sqlite.db");
const db = drizzle(sqlite);

function seed() {
  const [m1] = db
    .insert(matches)
    .values({
      title: "Training vs Alex",
      videoPath: "videos/training_alex_2024.mp4",
      durationSeconds: 3600,
      date: "2024-01-15",
      opponent: "Alex",
      result: "21-19 21-17",
      notes: "Good net play.",
    })
    .returning({ id: matches.id })
    .all();

  const [m2] = db
    .insert(matches)
    .values({
      title: "Club match vs Sam",
      videoPath: "videos/club_sam_2024.mp4",
      durationSeconds: 3300,
      date: "2024-02-01",
      opponent: "Sam",
      result: "21-14 18-21 21-16",
      notes: "",
    })
    .returning({ id: matches.id })
    .all();

  if (m1?.id) {
    const [r1, r2, r3] = db
      .insert(matchRally)
      .values([
        { matchId: m1.id, rallyLength: 1 },
        { matchId: m1.id, rallyLength: 1 },
        { matchId: m1.id, rallyLength: 1 },
      ])
      .returning({ id: matchRally.id })
      .all();
    if (r1?.id)
      db.insert(matchShots).values({
        matchId: m1.id,
        rallyId: r1.id,
        shotType: "smash",
        zoneFromSide: "me",
        zoneFrom: "center_mid",
        zoneToSide: "opponent",
        zoneTo: "left_back",
        outcome: "winner",
        isLastShotOfRally: true,
        player: "me",
      }).run();
    if (r2?.id)
      db.insert(matchShots).values({
        matchId: m1.id,
        rallyId: r2.id,
        shotType: "clear",
        zoneFromSide: "opponent",
        zoneFrom: "center_back",
        zoneToSide: "me",
        zoneTo: "center_back",
        outcome: "error",
        isLastShotOfRally: true,
        player: "opponent",
      }).run();
    if (r3?.id)
      db.insert(matchShots).values({
        matchId: m1.id,
        rallyId: r3.id,
        shotType: "drop",
        zoneFromSide: "me",
        zoneFrom: "left_front",
        zoneToSide: "opponent",
        zoneTo: "right_front",
        outcome: "winner",
        isLastShotOfRally: true,
        player: "me",
      }).run();
  }

  if (m2?.id) {
    const [r1, r2] = db
      .insert(matchRally)
      .values([
        { matchId: m2.id, rallyLength: 1 },
        { matchId: m2.id, rallyLength: 1 },
      ])
      .returning({ id: matchRally.id })
      .all();
    if (r1?.id)
      db.insert(matchShots).values({
        matchId: m2.id,
        rallyId: r1.id,
        shotType: "serve",
        zoneFromSide: "opponent",
        zoneFrom: "center_back",
        zoneToSide: "me",
        zoneTo: "center_front",
        outcome: "error",
        isLastShotOfRally: true,
        player: "opponent",
      }).run();
    if (r2?.id)
      db.insert(matchShots).values({
        matchId: m2.id,
        rallyId: r2.id,
        shotType: "drive",
        zoneFromSide: "me",
        zoneFrom: "center_mid",
        zoneToSide: "opponent",
        zoneTo: "right_mid",
        outcome: "winner",
        isLastShotOfRally: true,
        player: "me",
      }).run();
  }

  sqlite.close();
  console.log("Seed completed: 2 matches, rallies and shots.");
}

seed();
