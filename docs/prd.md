# Badminton Library — PRD

## Problem statement

Players record badminton matches but have no simple way to organize them, attach metadata (opponents, results), or turn raw footage into useful stats. Manual tallying of errors, winners, and shot types is tedious; automatic extraction is out of reach for a first version. This app provides a single place to store, label, and analyze match videos with minimal complexity.

## Target user and workflow

**User:** Solo developer / player (you). No multi-tenant or auth for v1.

**Workflow:** (1) Place video files in a designated folder. (2) App indexes or you add matches; attach date, opponents, result. (3) Optionally enter stats (errors, winners, shot types) per match or per point. (4) View charts and summaries. (5) Later: experiment with vision for auto-suggestions.

---

## Feature list and roadmap


| Phase  | Feature                 | Acceptance criteria                                                                                                                                            |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | Library + playback      | List matches (thumbnail, title, duration); click to play in-app. Videos loaded from one configurable root folder.                                              |
| **2**  | Metadata                | Create/edit match: date, opponents, result, notes. Filter/sort library by date, opponent.                                                                      |
| **3a** | Manual stats + analysis | Enter per-match or per-point: winner, errors, winners, shot types (serve, clear, smash, drop, etc.). Dashboards: shot distribution, errors vs winners, trends. |
| **3b** | Vision (stretch)        | Separate track: pose or shot-type experiment; integrate only when stable as “suggested” values user can confirm.                                               |


---

## Tech stack

- **Next.js (App Router) + TypeScript + Tailwind** — One codebase, API routes, modern UI, low ops.
- **SQLite + Drizzle (or Prisma)** — Single-file DB, type-safe ORM, migrations.
- **Video:** HTML5 `<video>` or Video.js; stream from local path (or URL later). No transcoding in v1.
- **Deploy:** Local first; optional Vercel for front-end only until cloud storage is added.

---

## Data model

- **matches** — `id`, `title`, `videoPath` (relative to root), `durationSeconds`, `date`, `opponent`, `result` (e.g. "21-19 21-17"), `notes`, `createdAt`, `updatedAt`.
- **match_stats** — `id`, `matchId` (FK), `pointIndex` (nullable for aggregate), `winner` (you|opponent), `isError`, `isWinner`, `shotType` (enum: serve, clear, smash, drop, etc.), `createdAt`.

One match has many match_stats (per-point or one aggregate row per match for a simpler v1).

---

## API endpoints


| Method | Path                      | Purpose                                              |
| ------ | ------------------------- | ---------------------------------------------------- |
| GET    | `/api/matches`            | List matches (query: sort, filter by date/opponent). |
| GET    | `/api/matches/[id]`       | Get one match with stats.                            |
| POST   | `/api/matches`            | Create match (metadata + videoPath).                 |
| PATCH  | `/api/matches/[id]`       | Update match metadata.                               |
| DELETE | `/api/matches/[id]`       | Delete match and its stats.                          |
| GET    | `/api/matches/[id]/stats` | Get stats for a match.                               |
| POST   | `/api/matches/[id]/stats` | Add or replace stats for a match.                    |
| GET    | `/api/video`              | Stream video by path (query: path=).                 |


Optional: `GET /api/config` for root folder path if stored in DB or env.