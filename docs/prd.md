# Badminton Library — PRD

## Problem statement

Players record badminton matches but have no simple way to organize them, attach metadata (opponents, results), or turn raw footage into useful stats. Manual tallying of errors, winners, and shot types is tedious; automatic extraction is out of reach for a first version. This app provides a single place to store, label, and analyze match videos with minimal complexity.

## Target user and workflow

**User:** Solo developer / player (you). No multi-tenant or auth for v1.

**Workflow:** (1) Place video files in a designated folder. (2) App indexes or you add matches; attach date, opponents, result. (3) Optionally enter stats (errors, winners, shot types) per match or per point. (4) View charts and summaries. (5) Run AI analysis on a match video to auto-suggest rallies and shots; review and confirm suggestions.

---

## Feature list and roadmap

| Phase | Feature                 | Acceptance criteria                                                                                                                                              |
| ----- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Library + playback      | List matches (thumbnail, title, duration); click to play in-app. Videos loaded from one configurable root folder.                                                |
| **2** | Metadata                | Create/edit match: date, opponents, result, notes. Filter/sort library by date, opponent.                                                                        |
| **3** | Manual stats + analysis | Enter per-match or per-point: winner, errors, winners, shot types (serve, clear, smash, drop, etc.). Dashboards: shot distribution, errors vs winners, trends.   |
| **4** | LLM video analysis      | Send match video to Gemini 2.5 Flash; receive structured rally + shot data as "suggested" values the user can confirm/edit. Shots marked `ai_suggested` until confirmed. |
| **5** | CV pipeline             | Python FastAPI microservice (`cv_service/`) with a 6-stage analysis pipeline: (1) PySceneDetect scene-cut filtering, (2) manual court calibration + homography, (3) YOLOv11 + ByteTrack player detection/tracking, (4) TrackNetV3 shuttle tracking (optional), (5) YOLOv11-Pose estimation, (6) heuristic shot classification + rally segmentation. Outputs rallies and shots to the existing schema via the Next.js bridge API at `POST /api/matches/[id]/cv-analyze`. Requires GPU for full pipeline; degrades gracefully without TrackNetV3. See `docs/cv_pipeline.md`. |

---

## Tech stack

- **Next.js (App Router) + TypeScript + Tailwind** — One codebase, API routes, modern UI, low ops.
- **SQLite + Drizzle (or Prisma)** — Single-file DB, type-safe ORM, migrations.
- **Video:** HTML5 `<video>` or Video.js; stream from local path (or URL later). No transcoding in v1.
- **AI (Phase 4):** `@google/genai` SDK + Gemini 2.5 Flash. Requires `GEMINI_API_KEY` env var (free from Google AI Studio).
- **CV (Phase 5):** Separate Python FastAPI service (`cv_service/`). PyTorch, Ultralytics (YOLO), TrackNetV3, PySceneDetect, OpenCV. Communicates with Next.js via HTTP. Requires `CV_SERVICE_URL` env var (default `http://127.0.0.1:8100`).
- **Deploy:** Local first; optional Vercel for front-end only until cloud storage is added.

---

## Data model

- **matches** — `id`, `title`, `videoPath` (relative to root), `durationSeconds`, `date`, `opponent`, `result` (e.g. "21-19 21-17"), `notes`, `createdAt`, `updatedAt`.
- **match_rallies** — `id`, `matchId` (FK), `rallyLength`, `wonByMe`, `createdAt`.
- **match_shots** — `id`, `matchId` (FK), `rallyId` (FK), `shotType`, `zoneFromSide`, `zoneFrom`, `zoneToSide`, `zoneTo`, `outcome`, `wonByMe`, `isLastShotOfRally`, `player`, `source` (manual | ai_suggested | ai_confirmed), `createdAt`.

One match has many rallies; one rally has many shots.

---

## API endpoints

| Method | Path                         | Purpose                                              |
| ------ | ---------------------------- | ---------------------------------------------------- |
| GET    | `/api/matches`               | List matches (query: sort, filter by date/opponent). |
| GET    | `/api/matches/[id]`          | Get one match with stats.                            |
| POST   | `/api/matches`               | Create match (metadata + videoPath).                 |
| PATCH  | `/api/matches/[id]`          | Update match metadata.                               |
| DELETE | `/api/matches/[id]`          | Delete match and its stats.                          |
| GET    | `/api/matches/[id]/stats`    | Get stats for a match.                               |
| POST   | `/api/matches/[id]/stats`    | Add or replace stats for a match.                    |
| POST   | `/api/matches/[id]/analyze`  | Trigger AI video analysis (Gemini 2.5 Flash).        |
| POST   | `/api/matches/[id]/cv-analyze` | Start CV pipeline analysis (local videos only). Returns `job_id`. |
| GET    | `/api/matches/[id]/cv-analyze?jobId=` | Poll CV job status. Writes results to DB on completion. |
| GET    | `/api/video`                 | Stream video by path (query: path=).                 |

Optional: `GET /api/config` for root folder path if stored in DB or env.
