# Analyze with AI — Setup and testing

The **Analyze with AI** flow uses **Google Gemini** (model `gemini-2.5-flash`) to watch a match video and suggest rallies and shots. No API key is required to run the app; the button will return a clear error if the key is missing.

---

## 1. Setup (no API key yet)

1. **Check status in the app**  
   Open **Settings** in the app. The **Analyze with AI** section shows **Not configured** when `GEMINI_API_KEY` is not set.

2. **Get a Gemini API key**
   - Go to [Google AI Studio](https://aistudio.google.com/apikey).
   - Sign in with your Google account.
   - Click **Create API key** (e.g. in a new or existing Google Cloud project).
   - Copy the key.

3. **Add the key to `.env`**
   - In the project root, open or create `.env` (you can copy from `.env.example`).
   - Add a line:
     ```env
     GEMINI_API_KEY=your_pasted_key_here
     ```
   - Save the file.

4. **Restart the dev server**  
   Env vars are read at startup. Stop `npm run dev` (Ctrl+C) and run `npm run dev` again.

5. **Verify in Settings**  
   Open **Settings** again. **Analyze with AI** should show **Configured**.

---

## 2. Testing each step

These steps confirm the code paths work as intended.

### 2.1 Unit tests (no API key or video needed)

From the project root:

```bash
npm run test -- --run src/lib/analyze_match.test.ts
```

You should see:

- `analyzeMatch` returns `NOT_FOUND` for a non-existent match id.
- `analyzeMatch` returns `API_KEY_MISSING` when the match exists but `GEMINI_API_KEY` is not set.

### 2.2 API: missing API key (manual)

1. Ensure `GEMINI_API_KEY` is **not** set in `.env` (or temporarily remove it), then restart the dev server.
2. Open any match page (e.g. `http://localhost:3000/match/1` if you have a match with id 1).
3. Click **Analyze with AI**.
4. **Expected:** Error message (e.g. “API_KEY_MISSING” or “Analysis failed”). The API returns status **500** with `error: "API_KEY_MISSING"`.

### 2.3 API: invalid match id

1. With the server running, call:
   ```bash
   curl -X POST http://localhost:3000/api/matches/999999/analyze
   ```
2. **Expected:** Status **404** and JSON with `error: "NOT_FOUND"`.

### 2.4 API: valid match, missing video (optional)

1. Set `GEMINI_API_KEY` in `.env` and restart.
2. Use a match whose `videoPath` does not exist under `VIDEO_ROOT` (or a GDrive file that is missing or not shared with the service account).
3. Click **Analyze with AI** for that match.
4. **Expected:** Error such as **VIDEO_NOT_FOUND** or **UPLOAD_FAILED** (status 404 or 502), not a generic crash.

### 2.5 Full flow: valid match with real video

1. `GEMINI_API_KEY` is set and **Settings** shows **Configured**.
2. You have a match whose video exists (local path under `VIDEO_ROOT` or a GDrive file that is accessible).
3. Open that match page and click **Analyze with AI**.
4. **Expected:** “Analyzing video…” for 1–3 minutes, then a success message like “Analysis complete — X rallies, Y shots detected.” The page refreshes and the right-hand panel and stats show the suggested rallies/shots.

If anything fails, check the browser Network tab for the `POST /api/matches/[id]/analyze` response body (`error` and `detail`) and the terminal for server errors.
