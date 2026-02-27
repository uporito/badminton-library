import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const matchCategoryEnum = [
  "Uncategorized",
  "Singles",
  "Doubles",
  "Mixed",
] as const;

export type MatchCategory = (typeof matchCategoryEnum)[number];

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  videoPath: text("video_path").notNull(),
  durationSeconds: integer("duration_seconds"),
  date: text("date"),
  opponent: text("opponent"),
  result: text("result"),
  notes: text("notes"),
  category: text("category", { enum: matchCategoryEnum }).default(
    "Uncategorized"
  ),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const matchRally = sqliteTable("match_rallies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  rallyLength: integer("rally_length").notNull().default(0),
  wonByMe: integer("won_by_me", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const zoneEnum = [
  "left_front",
  "left_mid",
  "left_back",
  "center_front",
  "center_mid",
  "center_back",
  "right_front",
  "right_mid",
  "right_back",
] as const;

export type Zone = (typeof zoneEnum)[number];

export const sideEnum = ["me", "opponent"] as const;

export type Side = (typeof sideEnum)[number];

export const shotTypeEnum = [
  "serve",
  "clear",
  "smash",
  "drop",
  "drive",
  "lift",
  "net",
  "block",
] as const;

export type ShotType = (typeof shotTypeEnum)[number];

export const outcomeEnum = ["winner", "error", "neither"] as const;

export type Outcome = (typeof outcomeEnum)[number];

export const matchShots = sqliteTable("match_shots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  rallyId: integer("rally_id")
    .notNull()
    .references(() => matchRally.id, { onDelete: "cascade" }),
  shotType: text("shot_type", { enum: shotTypeEnum }).notNull(),
  zoneFromSide: text("zone_from_side", { enum: sideEnum }).notNull(),
  zoneFrom: text("zone_from", { enum: zoneEnum }).notNull(),
  zoneToSide: text("zone_to_side", { enum: sideEnum }).notNull(),
  zoneTo: text("zone_to", { enum: zoneEnum }).notNull(),
  outcome: text("outcome", { enum: outcomeEnum }).notNull(),
  wonByMe: integer("won_by_me", { mode: "boolean" }),
  isLastShotOfRally: integer("is_last_shot_of_rally", { mode: "boolean" })
    .notNull()
    .default(false),
  player: text("player", { enum: sideEnum }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
