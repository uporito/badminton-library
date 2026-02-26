import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { matches, matchStats } from "./schema.js";

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
    db.insert(matchStats)
      .values([
        { matchId: m1.id, pointIndex: 1, winner: "you", isWinner: true, shotType: "smash" },
        { matchId: m1.id, pointIndex: 2, winner: "opponent", isError: true, shotType: "clear" },
        { matchId: m1.id, pointIndex: 3, winner: "you", isWinner: true, shotType: "drop" },
      ])
      .run();
  }

  if (m2?.id) {
    db.insert(matchStats)
      .values([
        { matchId: m2.id, pointIndex: 1, winner: "opponent", isError: true, shotType: "serve" },
        { matchId: m2.id, pointIndex: 2, winner: "you", isWinner: true, shotType: "drive" },
      ])
      .run();
  }

  sqlite.close();
  console.log("Seed completed: 2 matches, 5 stats rows.");
}

seed();
