# Badminton Library

A web app to store, label, and analyze badminton match videos. Add matches from a local video folder, attach metadata (date, opponents, result), and optionally enter stats per match or per point. Built for local-first use.

**Stack:** Next.js (App Router), TypeScript, Tailwind, SQLite, Drizzle ORM.

---

## Run from a new environment

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env`.
   - Set `VIDEO_ROOT` to the **absolute path** of the folder where your match videos live. All `videoPath` values in the DB are relative to this root.

3. **Database**
   ```bash
   npm run db:migrate
   ```
   (Creates `data/` and `data/sqlite.db` if needed.)

4. **Optional:** seed data
   ```bash
   npm run db:seed
   ```

5. **Dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Start Next.js dev server       |
| `npm run build`| Production build               |
| `npm run start`| Run production server          |
| `npm run db:migrate` | Run Drizzle migrations  |
| `npm run db:seed`    | Seed database           |
| `npm run test` | Run Vitest tests               |
| `npm run lint` | Run ESLint                     |

---

## More

- API and data model: see `docs/prd.md`.
