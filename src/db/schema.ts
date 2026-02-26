import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  videoPath: text("video_path").notNull(),
  durationSeconds: integer("duration_seconds"),
  date: text("date"),
  opponent: text("opponent"),
  result: text("result"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const matchStats = sqliteTable("match_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  pointIndex: integer("point_index"),
  winner: text("winner", { enum: ["you", "opponent"] }),
  isError: integer("is_error", { mode: "boolean" }).default(false),
  isWinner: integer("is_winner", { mode: "boolean" }).default(false),
  shotType: text("shot_type", {
    enum: [
      "serve",
      "clear",
      "smash",
      "drop",
      "drive",
      "lift",
      "net",
      "block",
    ],
  }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
