import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import * as schema from "./schema";

const dbPath = path.join(process.cwd(), "data", "sqlite.db");
const sqlite = new Database(dbPath);

export const db = drizzle(sqlite, { schema });
export {
  matches,
  matchRally,
  matchShots,
  players,
  matchPlayers,
  zoneEnum,
  sideEnum,
  shotPlayerEnum,
  shotTypeEnum,
  outcomeEnum,
  shotSourceEnum,
  partnerStatusEnum,
  matchPlayerRoleEnum,
} from "./schema";
export type {
  Zone,
  Side,
  ShotPlayer,
  ShotType,
  Outcome,
  ShotSource,
  PartnerStatus,
  MatchPlayerRole,
} from "./schema";
