# CV Video Analysis Pipeline

This document describes the computer-vision (CV) video analysis system (Phase 4) of the Badminton Library project. The system automatically processes local badminton match videos and extracts structured rally and shot data.

---

## Table of contents

1. [Big-picture architecture](#1-big-picture-architecture)
2. [CV pipeline architecture](#2-cv-pipeline-architecture)
3. [Pipeline stages in detail](#3-pipeline-stages-in-detail)
4. [Data models](#4-data-models)
5. [Configuration reference](#5-configuration-reference)
6. [Setup and run guide](#6-setup-and-run-guide)
7. [Limitations and future work](#7-limitations-and-future-work)

---

## 1. Big-picture architecture

The overall project is a **Next.js web application** backed by a **SQLite database** for match metadata and stats, with an optional **Python FastAPI microservice** for heavy CV processing.

```
┌──────────────────────────────────────────────────────────────────┐
│                         User (Browser)                           │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │ Match list  │  │ Match detail   │  │  Court calibration UI  │  │
│  │ Library     │  │ Video playback │  │  (4-corner click)      │  │
│  │ Stats/Charts│  │ Shot editor    │  │  CV Analyze button     │  │
│  └─────┬──────┘  └──────┬─────────┘  └──────────┬─────────────┘  │
│        │                │                        │                │
└────────┼────────────────┼────────────────────────┼────────────────┘
         │                │                        │
         ▼                ▼                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js App (App Router)                       │
│                                                                  │
│  API Routes:                                                     │
│  ├─ /api/matches/             CRUD for matches                   │
│  ├─ /api/matches/[id]/stats   Stats endpoints                    │
│  ├─ /api/matches/[id]/cv-analyze                                 │
│  │     POST → start CV job (proxy to Python service)             │
│  │     GET  → poll job status, write results to DB on completion  │
│  └─ /api/video                Video streaming                    │
│                                                                  │
│  Database:   SQLite via Drizzle ORM                              │
│  Tables:     matches, match_rallies, match_shots, players        │
└──────────────────────┬───────────────────────────────────────────┘
                       │ HTTP (JSON)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│               Python FastAPI CV Service (cv_service/)             │
│               Default: http://127.0.0.1:8100                     │
│                                                                  │
│  Endpoints:                                                      │
│  ├─ GET  /health              Service status + model availability │
│  ├─ POST /analyze             Start analysis job (returns job_id) │
│  └─ GET  /jobs/{job_id}       Poll job progress/result            │
│                                                                  │
│  Processing: Threaded background jobs                            │
│  Job store:  File-based (cv_service/jobs/*.json)                 │
│                                                                  │
│  Models loaded:                                                  │
│  ├─ YOLOv11n        (player detection, auto-downloaded)          │
│  ├─ YOLOv11n-Pose   (pose estimation, auto-downloaded)           │
│  └─ TrackNetV3      (shuttle tracking, manual setup)             │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────┐
│  Local video files   │
│  (VIDEO_ROOT folder) │
└──────────────────────┘
```

### Communication flow

1. User clicks **Calibrate Court** on a match page, marks the 4 court corners on a video frame, then optionally toggles which analysis features to run (shot type, placement, outcome). Click **CV Analysis**.
2. The React frontend sends `POST /api/matches/[id]/cv-analyze` with calibration and feature flags.
3. The Next.js API route resolves the local video path and forwards the request to `POST http://CV_SERVICE_URL/analyze`.
4. The Python service creates a background job, returns a `job_id` immediately.
5. The frontend polls `GET /api/matches/[id]/cv-analyze?jobId=...` every 2 seconds.
6. The Next.js route proxies to `GET http://CV_SERVICE_URL/jobs/{job_id}` and relays progress.
7. When the job completes, the Next.js route writes rallies and shots to the SQLite database (source = `ai_suggested`), then returns the final result.

---

## 2. CV pipeline architecture

The Python pipeline (`cv_service/pipeline.py`) processes a video through **5 sequential stages** that feed into each other:

```
 Video file
     │
     ▼
┌─────────────────────────────┐
│  Stage 1: Scene Cut         │  PySceneDetect
│  Detection                  │  → Filters out replays, intros, intervals
│  (scene_cut.py)             │  → Returns gameplay segments (frame ranges)
└─────────────┬───────────────┘
              │ gameplay segments
              ▼
┌─────────────────────────────┐
│  Stage 2: Court Detection   │  OpenCV homography
│  & Homography               │  → User provides 4 pixel-space corners
│  (court_detection.py)       │  → Computes 3×3 transform matrix
│                             │  → Enables pixel→court coordinate mapping
│                             │  → Maps positions to 9-zone grid
└─────────────┬───────────────┘
              │ Homography matrix
              ▼
┌─────────────────────────────────────────────────────┐
│  Per-frame loop (only gameplay segments)             │
│                                                     │
│  ┌─────────────────────────────┐                    │
│  │  Stage 3: Player Detection  │  Ultralytics       │
│  │  & Tracking                 │  YOLOv11n          │
│  │  (player_detection.py)      │  + ByteTrack       │
│  │  → Bounding boxes           │  → Consistent IDs  │
│  │  → Court positions (via H)  │  → Side assignment  │
│  └─────────────┬───────────────┘                    │
│                │                                    │
│  ┌─────────────▼───────────────┐                    │
│  │  Stage 4: Shuttle Tracking  │  TrackNetV3        │
│  │  (shuttle_tracking.py)      │  (optional)        │
│  │  → Pixel-space shuttle pos  │  → Court pos       │
│  │  → Confidence score         │  (via H)           │
│  └─────────────┬───────────────┘                    │
│                │                                    │
│  ┌─────────────▼───────────────┐                    │
│  │  Stage 5: Pose Estimation   │  YOLOv11n-Pose     │
│  │  (pose_estimation.py)       │  17 COCO keypoints │
│  │  → Skeleton per player      │  → Arm-raise flag  │
│  └─────────────┬───────────────┘                    │
│                │                                    │
│  Output: FrameData per frame                        │
│  (players[], shuttle?, keypoints[])                 │
└─────────────────────┬───────────────────────────────┘
                      │ list[FrameData]
                      ▼
┌─────────────────────────────────────────────────────┐
│  Hit Detection (hit_detection.py)                    │
│                                                     │
│  Primary: shuttle trajectory direction reversal      │
│           (angle change > 60° between velocity       │
│            vectors = hit)                            │
│                                                     │
│  Fallback: arm-raise pose detection                  │
│           (used when TrackNetV3 unavailable)         │
│                                                     │
│  → Assigns nearest player to each hit               │
│  → Records shuttle position at hit frame             │
└─────────────────────┬───────────────────────────────┘
                      │ list[HitEvent]
                      ▼
┌─────────────────────────────────────────────────────┐
│  Rally Segmentation (rally_segmentation.py)          │
│  → Groups hits by time gaps (default > 3s = new     │
│    rally)                                           │
│  → Discards single-hit rallies (likely false         │
│    positives)                                       │
└─────────────────────┬───────────────────────────────┘
                      │ list[list[HitEvent]]
                      ▼
┌─────────────────────────────────────────────────────┐
│  Shot Classification (shot_classification.py)        │
│  → Per-hit heuristic rules:                          │
│    • First hit in rally → serve                      │
│    • High speed + steep angle → smash                │
│    • Near net + short distance → net shot             │
│    • Long distance → clear                           │
│    • Fast + steep (not fastest) → drop               │
│    • Horizontal trajectory → drive                   │
│    • Upward trajectory → lift / block                │
│  → Zone mapping (from_side, from_zone, to_side,      │
│    to_zone) via homography                           │
│  → Outcome: last shot of rally = winner/error;       │
│    others = neither                                  │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
              AnalysisOutput
              {rallies[], rally_count, shot_count}
```

### Tier-based processing

The pipeline supports **modular analysis features**. The user can enable or disable each classification stage independently via `features` in the request:

| Feature | Controls | Requires calibration |
|---------|----------|------------------------|
| **Shot type** | serve, smash, clear, drop, etc. | Yes |
| **Placement** | zone_from, zone_to | Yes |
| **Outcome** | winner/error on last shot, won_by_me | Yes |

Rally and shot timestamp detection always runs. When a feature is disabled, defaults are used: `shot_type=clear`, zones=`center_mid`, outcome=`neither`, `won_by_me=null`. Without court calibration, all three features default to disabled (detection-only mode).

---

## 3. Pipeline stages in detail

### Stage 1: Scene Cut Detection

**File:** `cv_service/stages/scene_cut.py`
**Library:** [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) (`ContentDetector`)

**Purpose:** Splits the video timeline into segments and marks non-gameplay frames (slow-motion replays, player intros, intervals in broadcast footage). For amateur footage with no cuts, the entire video is treated as one segment.

**How it works:**
- Runs PySceneDetect's `ContentDetector` which computes a content-change score per frame.
- Frames where the score exceeds `scene_cut_threshold` (default 27.0) are marked as scene boundaries.
- Segments shorter than 3 seconds are classified as non-gameplay (typically transition cuts or replay inserts).
- Consecutive gameplay segments separated by less than 1 second are merged.

**Key parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `scene_cut_threshold` | 27.0 | Sensitivity of cut detection (lower = more sensitive) |
| `scene_cut_min_scene_len_sec` | 1.0 | Minimum segment duration to consider |

**Output:** `list[VideoSegment]` — each with `start_frame`, `end_frame`, `is_gameplay`.

---

### Stage 2: Court Detection & Homography

**File:** `cv_service/stages/court_detection.py`
**Library:** OpenCV (`cv2.findHomography`, `cv2.perspectiveTransform`)

**Purpose:** Computes a perspective transform (homography) that maps pixel coordinates in the video frame to real-world court coordinates in meters. This enables zone mapping and accurate position tracking.

**How it works:**
- The user provides 4 court corners in pixel coordinates via the calibration UI (top-left, top-right, bottom-right, bottom-left as seen from camera).
- These are mapped to reference court corners in meters using the standard doubles court dimensions (13.4m x 6.1m).
- OpenCV computes the 3x3 homography matrix `H` such that `court_point = H * pixel_point`.
- The inverse matrix `H_inv` is also computed for the reverse mapping.

**Zone grid (9 zones per half-court):**
```
 ┌───────────┬───────────┬───────────┐
 │ left_front│center_front│right_front│  ← Net
 ├───────────┼───────────┼───────────┤
 │ left_mid  │ center_mid│ right_mid │
 ├───────────┼───────────┼───────────┤
 │ left_back │center_back│right_back │  ← Baseline
 └───────────┴───────────┴───────────┘
```

Each half of the court is divided into a 3x3 grid (depth: front/mid/back, lateral: left/center/right). The `near_side` calibration parameter tells the system which player ("me" or "opponent") is on the camera-near side.

**Key parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `court_length` | 13.4 | Full court length in meters |
| `court_width` | 6.1 | Court width in meters (doubles) |
| `half_court_length` | 6.7 | Half court length (net to baseline) |

**Output:** `Homography` object with `pixel_to_court()`, `court_to_pixel()`, and `court_to_zone()` methods.

---

### Stage 3: Player Detection & Tracking

**File:** `cv_service/stages/player_detection.py`
**Library:** [Ultralytics](https://docs.ultralytics.com/) YOLOv11n + ByteTrack

**Purpose:** Detects all persons in each frame, tracks them across frames with consistent IDs, and assigns each to a court side.

**How it works:**
- YOLOv11n runs person detection (COCO class 0) on each frame.
- ByteTrack maintains track IDs across frames so the same player keeps the same ID.
- The bottom-center of each bounding box (foot position) is projected to court coordinates via the homography.
- Players with valid court positions are assigned to "me" or "opponent" side based on which half of the court they are in.
- `filter_court_players()` limits to at most 4 players on court (for doubles) and filters out spectators.

**Key parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `yolo_detect_model` | `yolo11n.pt` | YOLO model variant (auto-downloaded by Ultralytics) |
| `player_conf_threshold` | 0.4 | Minimum detection confidence |
| `player_iou_threshold` | 0.5 | IoU threshold for NMS |

**Output:** `list[PlayerBox]` per frame — each with `track_id`, `bbox`, `center`, `court_pos`, `side`.

---

### Stage 4: Shuttle Tracking (Optional)

**File:** `cv_service/stages/shuttle_tracking.py`
**Library:** [TrackNetV3](https://github.com/qaz812345/TrackNetV3) (PyTorch)

**Purpose:** Locates the shuttlecock in each frame. This is the most valuable signal for hit detection and shot classification but requires manual setup.

**How it works:**
- TrackNetV3 takes 3 consecutive frames (resized to 512x288), concatenated channel-wise (9-channel input).
- The model outputs a heatmap per frame; the peak of the heatmap is the predicted shuttle position.
- Positions with confidence below `shuttle_conf_threshold` are discarded.
- Pixel positions are mapped to court coordinates via the homography.
- If TrackNetV3 is unavailable (weights or repo not found), the pipeline falls back to pose-based hit detection (Stage 5).

**Key parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `tracknet_weights` | `tracknetv3.pt` | Weight file name in `cv_service/weights/` |
| `shuttle_conf_threshold` | 0.5 | Minimum heatmap peak to count as detection |

**Requirements (manual setup):**
1. Clone the TrackNetV3 repo into `cv_service/vendor/TrackNetV3`
2. Download pre-trained weights into `cv_service/weights/tracknetv3.pt`

**Output:** `ShuttlePosition | None` per frame — with `x`, `y` (pixel), `confidence`, `court_pos`.

---

### Stage 5: Pose Estimation

**File:** `cv_service/stages/pose_estimation.py`
**Library:** Ultralytics YOLOv11n-Pose

**Purpose:** Extracts 17 COCO skeleton keypoints per detected person. Used primarily as a fallback for hit detection when shuttle tracking is unavailable.

**How it works:**
- YOLOv11n-Pose runs on each frame, outputting 17 keypoints (x, y, confidence) per person.
- Each pose detection is matched to the nearest tracked player by bounding box center distance.
- Utility functions extract wrist/shoulder positions and detect arm-raising motions.
- `detect_arm_raised()` returns True when a wrist is significantly above the corresponding shoulder — a heuristic for a player executing a stroke.

**COCO keypoints used:**
| Index | Keypoint |
|-------|----------|
| 0 | Nose |
| 5, 6 | Left/Right shoulder |
| 7, 8 | Left/Right elbow |
| 9, 10 | Left/Right wrist |
| 11, 12 | Left/Right hip |

**Key parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `yolo_pose_model` | `yolo11n-pose.pt` | Pose model variant (auto-downloaded) |
| `player_conf_threshold` | 0.4 | Detection confidence threshold |

**Output:** `list[Keypoints]` per frame — each with `data` (flat list of 51 floats: 17 keypoints x 3) and `track_id`.

---

### Hit Detection

**File:** `cv_service/stages/hit_detection.py`

**Purpose:** Identifies the exact frames where a player strikes the shuttlecock.

**Primary method (trajectory-based, requires Stage 4):**
- Computes velocity vectors between consecutive shuttle positions.
- When the angle between successive velocity vectors exceeds `hit_angle_change_deg` (default 60 degrees), a hit is registered.
- A minimum gap of `hit_min_gap_frames` (default 5) prevents double-counting.
- The nearest player to the shuttle at hit time is identified as the striker.

**Fallback method (pose-based, when TrackNetV3 unavailable):**
- Scans all frames for the arm-raised pose pattern.
- When a player's wrist rises significantly above their shoulder, a hit is registered.
- Less accurate but works without shuttle tracking data.

**Key parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `hit_angle_change_deg` | 60.0 | Minimum direction change to trigger a hit |
| `hit_min_gap_frames` | 5 | Debounce gap between consecutive hits |

**Output:** `list[HitEvent]` — each with `frame_idx`, `timestamp`, `player_track_id`, `player_side`, `shuttle_px`, `shuttle_court`.

---

### Rally Segmentation

**File:** `cv_service/stages/rally_segmentation.py`

**Purpose:** Groups the flat list of hit events into rallies (sequences of continuous play).

**How it works:**
- Hits are scanned in time order. When the gap between two consecutive hits exceeds `rally_gap_seconds` (default 3.0), a new rally starts.
- Rallies with fewer than 2 hits are discarded as false positives.
- Each rally is then processed through shot classification.

**Key parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `rally_gap_seconds` | 3.0 | Time gap that starts a new rally |

**Output:** `list[list[HitEvent]]` — groups of hits, one group per rally.

---

### Shot Classification

**File:** `cv_service/stages/shot_classification.py`

**Purpose:** Classifies each hit into a shot type (serve, smash, drop, clear, drive, lift, net, block), determines zones, outcome, and player.

**Shot type rules (heuristic):**
| Rule | Shot Type |
|------|-----------|
| First hit of a rally | serve |
| Speed > 15 m/s + steep angle | smash |
| Near net + short travel distance | net |
| Steep angle + speed > 8 m/s | drop |
| Travel distance > 80% of half court | clear |
| Horizontal trajectory (dx/dy > 1.5) | drive |
| Upward trajectory + low speed | lift |
| High speed + steep angle (not fastest) | block |
| Default | clear |

**Zone determination:**
- `zone_from`: where the shuttle was at the previous hit (or player position if unavailable).
- `zone_to`: where the shuttle is at the current hit.
- Both mapped through the homography to `(side, zone)` pairs.

**Outcome determination:**
- Only the **last shot of a rally** gets a meaningful outcome.
- If the shuttle lands out of bounds → `error`.
- Otherwise → `winner`.
- All other shots → `neither`.

**Output:** `list[RallyResult]` with nested `list[ShotResult]`.

---

## 4. Data models

### Python service (Pydantic)

**Request/Response models** (`cv_service/models.py`):

| Model | Purpose |
|-------|---------|
| `AnalyzeRequest` | Input: `video_path`, `match_id`, optional `calibration`, `fps_override`, `features` |
| `AnalysisFeatures` | Optional flags: `shot_type`, `placement`, `outcome` (all default true) |
| `CourtCalibration` | 4 corner points in pixels + `near_side` enum |
| `Point2D` | Simple `{x, y}` coordinate |
| `ShotResult` | One shot: type, player, zones (from/to), outcome, timestamp |
| `RallyResult` | One rally: `won_by_me` (bool or null when outcome disabled) + list of `ShotResult` |
| `AnalysisOutput` | Final output: list of `RallyResult` + counts + `features` |
| `JobInfo` | Job status: `job_id`, `status`, `progress`, `progress_pct`, `result`, `error` |

**Internal models** (used between pipeline stages):

| Model | Purpose |
|-------|---------|
| `PlayerBox` | Detection: `track_id`, `bbox`, `center`, `court_pos`, `side` |
| `ShuttlePosition` | Shuttle: pixel coords, confidence, `court_pos` |
| `Keypoints` | 17 COCO keypoints as flat float list + `track_id` |
| `HitEvent` | Hit: `frame_idx`, `timestamp`, player info, shuttle positions |
| `FrameData` | All detections for one frame: players, shuttle, keypoints |

### Enums (shared between Python and TypeScript)

| Enum | Values |
|------|--------|
| `ShotType` | serve, clear, smash, drop, drive, lift, net, block |
| `Side` | me, opponent |
| `Zone` | left_front, left_mid, left_back, center_front, center_mid, center_back, right_front, right_mid, right_back |
| `Outcome` | winner, error, neither |
| `ShotPlayer` | me, partner, opponent |
| `JobStatus` | queued, running, completed, failed |

### Database tables (Drizzle ORM, TypeScript)

Results are written to the existing `match_rallies` and `match_shots` tables with `source = "ai_suggested"`. The `match_shots` table stores:
- `shotType`, `player`, `outcome`
- `zoneFromSide`, `zoneFrom`, `zoneToSide`, `zoneTo`
- `timestamp` (seconds from video start)
- `isLastShotOfRally`, `wonByMe`

---

## 5. Configuration reference

All settings are defined in `cv_service/config.py` via Pydantic `BaseSettings`. They can be overridden via environment variables prefixed with `CV_` or a `.env` file in the `cv_service/` directory.

| Setting | Env var | Default | Description |
|---------|---------|---------|-------------|
| `host` | `CV_HOST` | `127.0.0.1` | Service bind address |
| `port` | `CV_PORT` | `8100` | Service port |
| `weights_dir` | `CV_WEIGHTS_DIR` | `cv_service/weights/` | Directory for model weights |
| `vendor_dir` | `CV_VENDOR_DIR` | `cv_service/vendor/` | Directory for vendored repos |
| `jobs_dir` | `CV_JOBS_DIR` | `cv_service/jobs/` | Directory for job JSON files |
| `tracknet_weights` | `CV_TRACKNET_WEIGHTS` | `tracknetv3.pt` | TrackNetV3 weight file name |
| `yolo_detect_model` | `CV_YOLO_DETECT_MODEL` | `yolo11n.pt` | YOLO detection model |
| `yolo_pose_model` | `CV_YOLO_POSE_MODEL` | `yolo11n-pose.pt` | YOLO pose model |
| `scene_cut_threshold` | `CV_SCENE_CUT_THRESHOLD` | `27.0` | Scene change detection sensitivity |
| `scene_cut_min_scene_len_sec` | `CV_SCENE_CUT_MIN_SCENE_LEN_SEC` | `1.0` | Minimum scene length |
| `shuttle_conf_threshold` | `CV_SHUTTLE_CONF_THRESHOLD` | `0.5` | Shuttle detection confidence |
| `player_conf_threshold` | `CV_PLAYER_CONF_THRESHOLD` | `0.4` | Player detection confidence |
| `player_iou_threshold` | `CV_PLAYER_IOU_THRESHOLD` | `0.5` | NMS IoU threshold |
| `hit_angle_change_deg` | `CV_HIT_ANGLE_CHANGE_DEG` | `60.0` | Direction change for hit detection |
| `hit_min_gap_frames` | `CV_HIT_MIN_GAP_FRAMES` | `5` | Minimum frames between hits |
| `rally_gap_seconds` | `CV_RALLY_GAP_SECONDS` | `3.0` | Time gap to split rallies |
| `frame_skip` | `CV_FRAME_SKIP` | `1` | Process every Nth frame (1 = all) |
| `court_length` | `CV_COURT_LENGTH` | `13.4` | Court length in meters |
| `court_width` | `CV_COURT_WIDTH` | `6.1` | Court width in meters |
| `half_court_length` | `CV_HALF_COURT_LENGTH` | `6.7` | Half court length |

---

## 6. Setup and run guide

### Prerequisites

- **Node.js 18+** and **npm** (for the Next.js app)
- **Python 3.10+** (for the CV service)
- **A GPU with CUDA** is recommended for reasonable performance. The pipeline will run on CPU but will be very slow on longer videos.

### Step 1: Set up the Next.js app

```bash
# From the project root
npm install

# Create your .env file from the example
cp .env.example .env

# Edit .env and set at minimum:
#   VIDEO_ROOT=/absolute/path/to/your/video/folder
# Optionally set CV_SERVICE_URL if not using the default port:
#   CV_SERVICE_URL=http://127.0.0.1:8100
```

### Step 2: Set up the Python CV service

```bash
cd cv_service

# Create and activate a virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> **Note on PyTorch:** The `requirements.txt` installs CPU-only PyTorch by default. For GPU acceleration (highly recommended), install the CUDA version first:
> ```bash
> # Example for CUDA 12.1 (check https://pytorch.org/get-started for your version)
> pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
> pip install -r requirements.txt
> ```

### Step 3 (Optional): Enable shuttle tracking (TrackNetV3)

Shuttle tracking significantly improves hit detection and shot classification accuracy. Without it, the pipeline uses pose-based hit detection as a fallback.

```bash
# From cv_service directory
cd vendor
git clone https://github.com/qaz812345/TrackNetV3.git
cd ..
```

Then download the pre-trained TrackNetV3 weights and place them at:
```
cv_service/weights/tracknetv3.pt
```

**Where to get the weights:** Pre-trained weights (90.53% accuracy on the small-sample dataset) are hosted on **Google Drive**, linked from the TrackNetV3 repo README: [TrackNetV3 training weights](https://drive.google.com/file/d/1NDe_Wsl6n9l8qLBywjzCnBHcWAQ_Bqq5/view?usp=sharing). Download the file; if it has a different name (e.g. from the Drive zip), rename or copy it to `tracknetv3.pt`. You can also clone [TrackNetV3](https://github.com/alenzenx/TrackNetV3) (or [qaz812345/TrackNetV3](https://github.com/qaz812345/TrackNetV3)) and use the same Drive link from its README, or train from scratch using the repo’s instructions.

**Format:** PyTorch **`.pt`** checkpoint. The pipeline accepts either a full checkpoint dict containing `model_state_dict` or a raw state dict (as produced by the official repo’s training/evaluation scripts).

### Step 4: Start the services

**Terminal 1 — Python CV service:**
```bash
cd cv_service
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8100
```

Verify with:
```bash
curl http://127.0.0.1:8100/health
# → {"status":"ok","shuttle_tracking":true}  (or false if TrackNetV3 not set up)
```

**Terminal 2 — Next.js app:**
```bash
# From project root
npm run dev
```

### Step 5: Analyze a video

1. Open the app at `http://localhost:3000`.
2. Navigate to a match that has a **local video** (not a YouTube link).
3. Click **Calibrate Court**. A frame from the video will appear.
4. Click the **4 corners** of the court in order: far-left, far-right, near-right, near-left (as seen in the video). The UI draws guidelines as you click.
5. Optionally toggle which player is on the near side (default: "me").
6. Click **Confirm Calibration**.
7. Optionally enable or disable shot type, placement, and outcome (requires calibration).
8. Click **CV Analysis**.
9. Wait for the pipeline to process. Progress is displayed in real-time (stage name + percentage bar).
10. When complete, the page reloads and shows the detected rallies and shots, which you can review and edit.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot reach CV service" | Make sure `python main.py` is running and `CV_SERVICE_URL` matches |
| "CV analysis only supports local videos" | CV analysis requires a local video file, not YouTube |
| Very slow processing | Use GPU (CUDA), or set `CV_FRAME_SKIP=3` in `.env` for faster (less accurate) results |
| "TrackNetV3 weights not found" | Follow Step 3 above; the pipeline will still work using pose-based fallback |
| YOLO models downloading on first run | Normal — Ultralytics auto-downloads `yolo11n.pt` and `yolo11n-pose.pt` on first use |

---

## 7. Limitations and future work

### Current limitations

- **Shot classification is heuristic-based.** Rules work reasonably well for common shots but can misclassify edge cases (e.g. a fast drop vs a slow smash).
- **Court calibration is manual.** The user must click 4 corners for each video. Without calibration, zone mapping defaults to `center_mid`.
- **Single camera assumption.** The pipeline assumes a fixed camera throughout each gameplay segment. Moving cameras will break the homography.
- **No doubles partner tracking.** Players are classified as "me" or "opponent" based on court side; distinguishing individual doubles partners is not implemented.

### Planned improvements

- **Automatic court detection** using line detection (Hough transform) or a trained segmentation model to remove the need for manual calibration.
- **LSTM/BST shot classifier** trained on labeled badminton data for significantly better classification accuracy.
- **RTMPose (MMPose)** as an alternative pose estimation model for better keypoint accuracy.
- **Score tracking** by combining rally segmentation with outcome detection.
- **YouTube video support** by downloading videos to a temp directory before processing.
- **Batch processing** for analyzing multiple matches in sequence.
