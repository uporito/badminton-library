import {
  integer,
  real,
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

export const videoSourceEnum = ["local", "gdrive", "youtube"] as const;

export type VideoSource = (typeof videoSourceEnum)[number];

export const partnerStatusEnum = ["none", "unknown", "player"] as const;

export type PartnerStatus = (typeof partnerStatusEnum)[number];

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  videoPath: text("video_path").notNull(),
  videoSource: text("video_source", { enum: videoSourceEnum }).notNull().default("local"),
  durationSeconds: integer("duration_seconds"),
  date: text("date"),
  result: text("result"),
  notes: text("notes"),
  myDescription: text("my_description"),
  opponentDescription: text("opponent_description"),
  tags: text("tags"),
  category: text("category", { enum: matchCategoryEnum }).default(
    "Uncategorized"
  ),
  wonByMe: integer("won_by_me", { mode: "boolean" }),
  partnerStatus: text("partner_status", { enum: partnerStatusEnum })
    .notNull()
    .default("none"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  winsWith: integer("wins_with").notNull().default(0),
  winsAgainst: integer("wins_against").notNull().default(0),
  lossesWith: integer("losses_with").notNull().default(0),
  lossesAgainst: integer("losses_against").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const matchPlayerRoleEnum = ["opponent", "partner"] as const;

export type MatchPlayerRole = (typeof matchPlayerRoleEnum)[number];

export const matchPlayers = sqliteTable("match_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  role: text("role", { enum: matchPlayerRoleEnum }).notNull(),
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

export const shotPlayerEnum = ["me", "partner", "opponent"] as const;

export type ShotPlayer = (typeof shotPlayerEnum)[number];

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

export const shotSourceEnum = ["manual", "ai_suggested", "ai_confirmed"] as const;

export type ShotSource = (typeof shotSourceEnum)[number];

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
  player: text("player", { enum: shotPlayerEnum }).notNull(),
  source: text("source", { enum: shotSourceEnum }).notNull().default("manual"),
  timestamp: real("timestamp"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
