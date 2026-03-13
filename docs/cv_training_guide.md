# CV Pipeline — Training, Tuning & Evaluation Guide

This guide walks through improving every stage of the CV pipeline from raw accuracy to production quality. It covers what resources you need to provide, where your manual time goes, and how to measure progress at each stage and globally.

---

## Table of contents

1. [The big picture: iterative, not sequential](#1-the-big-picture-iterative-not-sequential)
2. [Resource inventory: what you need to provide](#2-resource-inventory-what-you-need-to-provide)
3. [Building your ground-truth dataset](#3-building-your-ground-truth-dataset)
4. [Stage-by-stage improvement playbook](#4-stage-by-stage-improvement-playbook)
5. [Global evaluation: end-to-end metrics](#5-global-evaluation-end-to-end-metrics)
6. [The iteration loop](#6-the-iteration-loop)
7. [Time investment summary](#7-time-investment-summary)
8. [Appendix: scripts and tooling](#8-appendix-scripts-and-tooling)

---

## 1. The big picture: iterative, not sequential

**Short answer: iterative end-to-end, with focused deep-dives on the weakest stage.**

The pipeline is a chain — errors compound downstream. A missed shuttle detection causes a missed hit, which ruins rally segmentation, which corrupts shot classification. But you don't improve it by perfecting Stage 1 before touching Stage 2. Instead:

```
┌──────────────────────────────────────────────────────────┐
│                    THE IMPROVEMENT LOOP                   │
│                                                          │
│  1. Run full pipeline on your evaluation set             │
│  2. Score global metrics (rally count, shot accuracy)    │
│  3. Identify the weakest link (which stage hurts most?)  │
│  4. Deep-dive that stage: tune thresholds / retrain      │
│  5. Re-run full pipeline, compare global metrics         │
│  6. Repeat from step 3                                   │
└──────────────────────────────────────────────────────────┘
```

Why iterative works better:
- You get a baseline immediately, before any tuning.
- You focus effort where it has the most impact on the final output.
- You avoid over-optimizing a stage in isolation only to find the next stage can't use the improvement.
- Threshold changes in one heuristic stage (e.g. hit detection) can mask or amplify issues in another (rally segmentation).

---

## 2. Resource inventory: what you need to provide

### 2.1 Videos (the raw material)

| What | Quantity | Why |
|------|----------|-----|
| **Evaluation clips** | 3–5 clips, 2–5 minutes each | Stable set you never tune against — your "test set" |
| **Tuning clips** | 3–5 clips, 2–5 minutes each | Your "dev set" — you actively tune thresholds against these |
| **Training clips** (for fine-tuning models) | 10–30 clips, any length | Only needed if you fine-tune YOLO or TrackNet |

Pick videos that cover your variety: different camera angles, lighting, court types, singles vs doubles. Your own match recordings are ideal because they represent the distribution you actually care about.

### 2.2 Ground-truth annotations (your main manual effort)

| Annotation type | What you label | Tool | Time per clip |
|-----------------|---------------|------|---------------|
| **Rally boundaries** | Start/end timestamps of each rally | Spreadsheet or simple text file | 10–20 min per 5-min clip |
| **Shot events** | Timestamp + shot type + player for each hit | Spreadsheet | 30–60 min per 5-min clip |
| **Player bounding boxes** | Rectangles around players (for YOLO fine-tuning) | CVAT, Labelme, or Roboflow | 2–5 hours per 1000 frames |
| **Shuttle positions** | x,y pixel position per frame (for TrackNet fine-tuning) | Custom script or CVAT | 5–10 hours per 1000 frames |
| **Court corners** | 4 corner pixel coords per clip | The app's calibration UI | 1 min per clip |

**You don't need all of these.** Start with just rally boundaries and shot events — they let you evaluate the full pipeline without fine-tuning any ML models.

### 2.3 Compute

| Task | GPU needed? | Time estimate |
|------|------------|---------------|
| Running the pipeline on a 5-min clip | Highly recommended | 2–5 min with GPU, 30–60 min without |
| YOLO fine-tuning (1000 images, 50 epochs) | Required | 1–3 hours on consumer GPU |
| TrackNet fine-tuning (5000 frames, 30 epochs) | Required | 2–6 hours on consumer GPU |
| Threshold tuning (grid search) | Recommended | 10–30 min per sweep |

---

## 3. Building your ground-truth dataset

This is where most of your manual time goes. The quality of your labels directly determines the quality of your evaluations.

### 3.1 Ground-truth file format

Create one JSON file per video clip in `cv_service/eval/ground_truth/`:

```
cv_service/
└── eval/
    ├── ground_truth/
    │   ├── clip_001.json
    │   ├── clip_002.json
    │   └── ...
    ├── predictions/        ← pipeline output gets saved here
    ├── results/            ← evaluation scores get saved here
    └── evaluate.py         ← evaluation script (see Appendix)
```

**Ground-truth JSON schema:**

```json
{
  "video_path": "path/to/clip_001.mp4",
  "calibration": {
    "top_left": {"x": 120, "y": 45},
    "top_right": {"x": 530, "y": 48},
    "bottom_right": {"x": 560, "y": 420},
    "bottom_left": {"x": 95, "y": 418},
    "near_side": "me"
  },
  "rallies": [
    {
      "start_sec": 5.2,
      "end_sec": 18.7,
      "won_by_me": true,
      "shots": [
        {
          "timestamp": 5.2,
          "shot_type": "serve",
          "player": "me",
          "zone_from": "right_back",
          "zone_to": "center_front",
          "outcome": "neither"
        },
        {
          "timestamp": 6.8,
          "shot_type": "clear",
          "player": "opponent",
          "zone_from": "center_front",
          "zone_to": "center_back",
          "outcome": "neither"
        },
        {
          "timestamp": 8.1,
          "shot_type": "smash",
          "player": "me",
          "zone_from": "center_back",
          "zone_to": "center_front",
          "outcome": "winner"
        }
      ]
    }
  ]
}
```

### 3.2 How to create ground-truth labels (practical workflow)

**Step 1: Watch the video and mark rally timestamps (10–20 min per clip)**

Open the video in any player with frame-stepping (VLC, mpv, or the app itself). For each rally:
- Note the timestamp when the serve is hit
- Note the timestamp of the last shot
- Note who won the rally

A simple spreadsheet works fine initially:

| Rally | Start | End | Won by me? |
|-------|-------|-----|------------|
| 1 | 5.2 | 18.7 | yes |
| 2 | 25.1 | 31.4 | no |

**Step 2: Mark individual shots within each rally (30–60 min per clip)**

Go back through each rally and for each hit:
- Note the timestamp
- Note who hit it (me/opponent)
- Note the shot type (serve, clear, smash, drop, drive, lift, net, block)
- Optionally note zones (from/to) — skip this initially if it slows you down

**Tip:** Don't agonize over borderline shot types (is it a fast drop or a slow smash?). Label what feels right. The heuristic classifier has the same ambiguity — your labels define what "correct" means for your use case.

**Step 3: Run the pipeline and save predictions**

```bash
cd cv_service
python eval/run_eval.py --video path/to/clip_001.mp4 \
  --ground-truth eval/ground_truth/clip_001.json \
  --output eval/predictions/clip_001.json
```

**Step 4: Compare predictions to ground truth**

```bash
python eval/evaluate.py --ground-truth eval/ground_truth/ \
  --predictions eval/predictions/ \
  --output eval/results/run_001.json
```

### 3.3 Labeling conventions (important)

Consistent timestamps are critical — if the yardstick is fuzzy, your metrics become meaningless. The pipeline detects hits as **trajectory direction changes** (the instant of racket-shuttle contact) and derives rally boundaries from the first and last hit timestamps. Your labels must follow the same convention.

**Always timestamp the moment of contact**, not what happens after. The evaluation script matches shots with a ±0.5 s tolerance window, so even small systematic offsets (e.g. labeling when the shuttle lands instead of when it's struck) can cause correct detections to appear as misses.

| Event | Timestamp at… | NOT at… |
|-------|---------------|---------|
| Any shot | Racket-shuttle contact | Shuttle landing or peak height |
| Serve | Contact on the serve swing | Shuttle toss or backswing |
| Last shot (winner) | Contact of the winning hit | Shuttle hitting the floor |
| Last shot (error) | Contact of the errant hit | Shuttle going out / hitting net |
| Rally start | First shot (serve) contact | Player walking to service position |
| Rally end | Last shot contact | Shuttle landing, players reacting |

The time between rallies (picking up the shuttle, walking to position) belongs to **neither** rally. The pipeline uses `rally_gap_seconds` to split rallies by the gap between consecutive contacts, so including non-play time in rally boundaries would inflate your ground-truth durations and distort overlap-based matching.

**Why this matters for tuning:** The grid search finds thresholds that minimize the gap between predictions and ground truth. If your labels systematically add 1–2 s to rally end times, the tuner compensates by inflating `rally_gap_seconds` — optimizing for the wrong thing. Likewise, an eventual ML shot classifier trains directly on your labels, so inconsistency there becomes noise in the training data.

### 3.4 Minimum viable dataset

To get started with meaningful evaluations, label at minimum:

| Resource | Count | Time |
|----------|-------|------|
| Evaluation clips with rally boundaries | 3 clips | 1 hour |
| Evaluation clips with shot-level labels | 3 clips | 2–3 hours |
| Tuning clips with rally boundaries | 3 clips | 1 hour |

**Total initial time investment: ~5 hours of labeling.**

After this you can run the full evaluation loop and identify where to focus.

---

## 4. Stage-by-stage improvement playbook

### Stage 1: Scene Cut Detection

**What can go wrong:** Broadcast footage has replays, intros, and scoreboards interleaved with gameplay. If scene cuts are detected too aggressively, real gameplay gets split. Too leniently, replays get processed as gameplay.

**How to evaluate it in isolation:**

Run scene cut detection alone and compare to manually marked gameplay segments:

```python
from stages.scene_cut import detect_scene_cuts, merge_gameplay_segments

segments = detect_scene_cuts("clip.mp4", fps=30.0, total_frames=9000)
gameplay = merge_gameplay_segments(segments)

for seg in gameplay:
    print(f"  {seg.start_sec:.1f}s – {seg.end_sec:.1f}s  gameplay={seg.is_gameplay}")
```

Compare against your ground-truth rally boundaries: gameplay segments should contain all rallies and exclude obvious non-gameplay.

**Metrics:**
- **Gameplay coverage**: % of ground-truth rally seconds that fall within detected gameplay segments (target: >95%)
- **Non-gameplay rejection**: % of non-gameplay seconds correctly excluded (target: >80%)

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| Tune `scene_cut_threshold` | Lower = more sensitive (more cuts detected). Try 20–35 range. | 10 min |
| Tune `scene_cut_min_scene_len_sec` | Increase to ignore short replay inserts. | 5 min |
| For amateur footage with no cuts | This stage should pass everything through as one segment. Verify it does. | 5 min |

**When to skip:** If you only record your own matches with a fixed camera, this stage is a no-op. Verify once, then move on.

---

### Stage 2: Court Detection & Homography

**What can go wrong:** Inaccurate corner clicks → distorted zone mapping → wrong zone labels on every shot. The camera moving during the match breaks the homography entirely.

**How to evaluate it in isolation:**

After calibrating, project known court positions back to pixel space and visually verify:

```python
from stages.court_detection import compute_homography
from models import CourtCalibration, Point2D, Side

cal = CourtCalibration(
    top_left=Point2D(x=120, y=45),
    top_right=Point2D(x=530, y=48),
    bottom_right=Point2D(x=560, y=420),
    bottom_left=Point2D(x=95, y=418),
    near_side=Side.me,
)
H = compute_homography(cal)

# Project court center to pixels — should land at net center in the video
px, py = H.court_to_pixel(3.05, 6.7)
print(f"Net center in pixels: ({px:.0f}, {py:.0f})")

# Check all 4 service line intersections
for name, cx, cy in [("near-left service", 0.76, 11.88),
                      ("near-right service", 5.34, 11.88),
                      ("far-left service", 0.76, 1.52),
                      ("far-right service", 5.34, 1.52)]:
    px, py = H.court_to_pixel(cx, cy)
    print(f"  {name}: ({px:.0f}, {py:.0f})")
```

Overlay these points on a video frame to see if they land on actual court lines.

**Metrics:**
- **Reprojection error**: average pixel distance between projected reference points and actual court line intersections (target: <15 pixels)

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| More precise corner clicks | Zoom into the calibration UI frame before clicking | 2 min |
| Automate court detection | Train a line-detection model or use Hough transforms to find court lines automatically | Days–weeks (future work) |
| Handle camera shake | Use frame-to-frame homography estimation (optical flow). Significant engineering effort. | Weeks (future work) |

**Manual time:** ~1 minute per clip to calibrate. This is fast. Accuracy depends on your click precision.

---

### Stage 3: Player Detection & Tracking

**What can go wrong:** Missing detections (players too small, occluded, or unusual clothing blending with the court), ID switches (ByteTrack loses track and assigns a new ID), spectators detected as players.

**How to evaluate it in isolation:**

Run detection on a clip and visually inspect a sample of frames:

```python
import cv2
from stages.player_detection import detect_players_in_frame, reset_tracker
from stages.court_detection import compute_homography

# Load video, compute homography...
reset_tracker()
cap = cv2.VideoCapture("clip.mp4")
for frame_idx in range(0, 300, 30):  # sample every 30 frames
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    players = detect_players_in_frame(frame, homography=H)
    for p in players:
        x1, y1, x2, y2 = [int(v) for v in p.bbox]
        color = (0, 255, 0) if p.side == Side.me else (0, 0, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"ID:{p.track_id}", (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    cv2.imwrite(f"eval/debug/players_{frame_idx:04d}.png", frame)
cap.release()
```

**Metrics:**
- **Detection recall**: % of actual player-frames where a player is detected (target: >90%)
- **Court filtering precision**: % of detections that are actual court players, not spectators (target: >95%)
- **Track consistency**: % of frames where a player's track_id stays the same (target: >85%)

To measure these, you'd need bounding box annotations for a sample of frames. For a quick sanity check, visual inspection of the debug images is sufficient.

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| Tune `player_conf_threshold` | Lower for more recall, higher for less noise. Try 0.25–0.5. | 10 min |
| Tune `player_iou_threshold` | Affects NMS. Lower = more aggressive suppression. | 10 min |
| Use a larger YOLO model | Switch `yolo_detect_model` to `yolo11s.pt` or `yolo11m.pt`. More accurate but slower. | 5 min (config change), 2–3x slower inference |
| Fine-tune YOLO on badminton data | Label player bounding boxes on your court frames, fine-tune with Ultralytics training API. | See [Fine-tuning YOLO](#fine-tuning-yolo-for-player-detection) below |
| Improve court filtering | Adjust `filter_court_players` logic if spectators are consistently within court bounds. | 30 min code change |

---

### Stage 4: Shuttle Tracking (TrackNetV3)

**What can go wrong:** The shuttle is tiny (often <10 pixels) and fast. TrackNet may miss it in poor lighting, produce false positives on white court lines or clothing, or lose tracking during fast smashes.

**This is typically the highest-impact stage to improve** — shuttle trajectory quality directly determines hit detection accuracy, which cascades into everything downstream.

**How to evaluate it in isolation:**

```python
import cv2
from stages.shuttle_tracking import detect_shuttle, is_available

if not is_available():
    print("TrackNet not installed — using pose fallback")
else:
    cap = cv2.VideoCapture("clip.mp4")
    frame_buffer = []
    shuttle_positions = []
    for i in range(300):
        ret, frame = cap.read()
        frame_buffer.append(frame)
        if len(frame_buffer) >= 3:
            results = detect_shuttle(frame_buffer[-3:], homography=H)
            pos = results[-1]  # last frame's detection
            shuttle_positions.append((i, pos))
            if pos:
                cv2.circle(frame, (int(pos.x), int(pos.y)), 5, (0, 255, 255), -1)
        cv2.imwrite(f"eval/debug/shuttle_{i:04d}.png", frame)
    cap.release()

    detected = sum(1 for _, p in shuttle_positions if p is not None)
    print(f"Shuttle detected in {detected}/{len(shuttle_positions)} frames "
          f"({detected/len(shuttle_positions)*100:.1f}%)")
```

**Metrics:**
- **Shuttle detection rate**: % of frames where the shuttle is visible and detected (target: >60% — the shuttle is genuinely invisible in many frames)
- **False positive rate**: % of detections that are not the shuttle (inspect debug images)
- **Position accuracy**: average pixel distance from detected to actual shuttle position (target: <20px)

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| Tune `shuttle_conf_threshold` | Lower for more detections (more noise), higher for fewer (more misses). Try 0.3–0.7. | 10 min |
| Fine-tune TrackNetV3 on your footage | Label shuttle positions on your frames, retrain. Highest-impact improvement. | See [Fine-tuning TrackNet](#fine-tuning-tracknetv3) below |
| Use the official TrackNet training data as a starting point | The TrackNet repo includes labeled badminton data — fine-tune from there, then adapt to your videos. | 3–6 hours |
| Temporal smoothing | Post-process detections: interpolate gaps, reject isolated single-frame detections. | 1–2 hours code change |

---

### Stage 5: Pose Estimation

**What can go wrong:** Keypoints land on wrong body parts (especially when players are small or partially occluded), confidence scores are unreliable, arm-raise detection triggers on non-stroke motions.

**How to evaluate it in isolation:**

```python
import cv2
from stages.pose_estimation import estimate_poses, detect_arm_raised

cap = cv2.VideoCapture("clip.mp4")
arm_raise_count = 0
for i in range(300):
    ret, frame = cap.read()
    kps_list = estimate_poses(frame)
    for kp in kps_list:
        raised = detect_arm_raised(kp)
        if raised:
            arm_raise_count += 1
        # Draw skeleton on frame for visual inspection
        for j in range(0, len(kp.data), 3):
            x, y, conf = kp.data[j], kp.data[j+1], kp.data[j+2]
            if conf > 0.5:
                cv2.circle(frame, (int(x), int(y)), 3, (255, 0, 255), -1)
    cv2.imwrite(f"eval/debug/pose_{i:04d}.png", frame)
cap.release()
print(f"Arm raises detected: {arm_raise_count}")
```

**Metrics:**
- **Arm-raise precision**: % of detected arm raises that correspond to actual strokes (target: >70%)
- **Arm-raise recall**: % of actual strokes detected via arm raise (target: >50%)
- These only matter as fallback metrics when TrackNet is unavailable.

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| Use a larger pose model | Switch to `yolo11s-pose.pt` or `yolo11m-pose.pt`. | 5 min config change |
| Tune arm-raise `threshold_ratio` | Adjust in `detect_arm_raised()`. | 10 min |
| Replace with RTMPose (MMPose) | Better keypoint accuracy, especially for small figures. Requires code changes. | 1–2 days |

---

### Hit Detection (heuristic, post-processing stage)

**What can go wrong:** False positive hits (noise in shuttle trajectory triggers angle-change detection), missed hits (shuttle tracking gap right at the hit moment), wrong player attributed.

**How to evaluate it:**

Compare predicted hit timestamps against ground-truth shot timestamps.

**Metrics (the most important stage-level metrics):**
- **Hit recall**: % of ground-truth shots that have a predicted hit within ±0.5 seconds (target: >80%)
- **Hit precision**: % of predicted hits that match a ground-truth shot (target: >70%)
- **Player attribution accuracy**: of correctly detected hits, % with the right player (target: >80%)

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| Tune `hit_angle_change_deg` | Lower = more sensitive, more false positives. Higher = fewer hits, more misses. Try 40–80. | 10 min |
| Tune `hit_min_gap_frames` | Higher = fewer double-detections. Try 3–10. | 10 min |
| Improve shuttle tracking upstream | Better shuttle data → better trajectory → better hit detection. This is usually the bigger win. | See Stage 4 |
| Combine trajectory + pose signals | Use arm-raise as a confirming signal even when shuttle tracking is available. | 2–4 hours code change |
| Add velocity magnitude threshold | Require minimum shuttle speed at direction change to filter noise. | 1 hour code change |

---

### Rally Segmentation (heuristic)

**What can go wrong:** Rallies merged (gap too short for your footage), rallies split (long rally with a pause > threshold), false rallies from noise hits.

**How to evaluate it:**

**Metrics:**
- **Rally count accuracy**: |predicted rally count − actual rally count| / actual count (target: <20% error)
- **Rally match rate**: % of ground-truth rallies that have a 1:1 match with a predicted rally (target: >80%)
  - A match: predicted rally overlaps >50% of ground-truth rally time span

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| Tune `rally_gap_seconds` | Try 2.0–5.0. Longer gaps are common in recreational play. | 10 min |
| Minimum rally length filter | Discard rallies with <2 shots (already implemented) or <1.5 seconds. | 15 min code change |
| Improve hit detection upstream | Fewer false positive hits → cleaner rally grouping. | See Hit Detection |

---

### Shot Classification (heuristic)

**What can go wrong:** Misclassification of shot types (fast drop labeled as smash, clear labeled as drive), zone assignments wrong due to homography error, outcomes wrong.

**How to evaluate it:**

**Metrics:**
- **Shot type accuracy**: % of shots where predicted type matches ground-truth type (target: >60% initially, >75% with tuning)
- **Shot type confusion matrix**: reveals systematic misclassifications (e.g. always confusing drop/smash)
- **Zone accuracy**: % of shots with correct zone_from and zone_to (target: >50%, heavily depends on homography quality)

**How to improve it:**

| Lever | How | Effort |
|-------|-----|--------|
| Tune classification thresholds | Adjust speed/angle/distance thresholds in `classify_shot_heuristic()`. See grid search approach below. | 1–2 hours |
| Add more heuristic rules | Handle edge cases (e.g. distinguish backhand net shots, cross-court drives). | 2–4 hours |
| Train an ML classifier | Replace heuristics with a small neural network trained on your labeled shots. See below. | 1–2 days |
| Improve shuttle tracking upstream | Better shuttle positions → better speed/angle/distance calculations → better classification. | See Stage 4 |

---

## 5. Global evaluation: end-to-end metrics

These are the metrics that tell you whether the pipeline as a whole is getting better.

### 5.1 Rally-level metrics

| Metric | How to compute | Target |
|--------|---------------|--------|
| **Rally count error** | \|predicted − actual\| / actual | <20% |
| **Rally match F1** | Harmonic mean of precision (what % of predicted rallies are real) and recall (what % of real rallies are detected) | >0.75 |
| **Rally winner accuracy** | Of matched rallies, % where `won_by_me` is correct | >70% |

### 5.2 Shot-level metrics (within matched rallies)

| Metric | How to compute | Target |
|--------|---------------|--------|
| **Shot count error per rally** | Average \|predicted − actual\| across matched rallies | <2 shots |
| **Shot type accuracy** | % of timestamp-matched shots with correct type | >60% |
| **Shot type weighted F1** | Per-class F1, weighted by class frequency | >0.55 |

### 5.3 Tracking the metrics over time

After each tuning iteration, log results in a simple tracking file:

```
cv_service/eval/results/history.csv
```

```csv
run_id,date,description,rally_f1,shot_type_acc,rally_count_err,notes
baseline,2026-03-12,Default config no changes,0.45,0.38,0.35,First run
tune_001,2026-03-13,hit_angle 50 rally_gap 4.0,0.52,0.41,0.28,Better rally detection
tune_002,2026-03-14,shuttle_conf 0.35,0.58,0.44,0.22,More shuttle detections helped
```

This gives you a clear performance trajectory and lets you roll back bad changes.

---

## 6. The iteration loop

### Phase 1: Establish baseline (Day 1)

**Manual time: ~5 hours**

1. Select 3 evaluation clips and 3 tuning clips
2. Calibrate court corners for all 6 clips (6 minutes)
3. Label rally boundaries for all 6 clips (2 hours)
4. Label shot events for all 6 clips (3 hours)
5. Run the pipeline on all 6 clips with default config
6. Compute all metrics — this is your baseline

### Phase 2: Quick wins — threshold tuning (Days 2–3)

**Manual time: ~3 hours**

This is where you get the most improvement for the least effort. Run a grid search over the key thresholds using your tuning clips:

```python
# Pseudocode for threshold grid search
configs = []
for hit_angle in [40, 50, 60, 70, 80]:
    for rally_gap in [2.0, 3.0, 4.0, 5.0]:
        for shuttle_conf in [0.3, 0.4, 0.5, 0.6]:
            configs.append({
                "hit_angle_change_deg": hit_angle,
                "rally_gap_seconds": rally_gap,
                "shuttle_conf_threshold": shuttle_conf,
            })

for config in configs:
    # Apply config, run pipeline on tuning clips, compute metrics
    ...

# Pick the config with best rally_f1 on tuning clips
# Verify it also improves on evaluation clips (not just tuning clips)
```

Expected improvement: 10–30% on rally F1, 5–15% on shot type accuracy.

### Phase 3: Targeted model improvement (Days 4–14)

**Manual time: varies by approach**

Based on your Phase 2 analysis, pick the weakest link and invest:

**If shuttle tracking is the bottleneck (most likely):**
- Fine-tune TrackNetV3 on your footage (see section below)
- Expected improvement: 15–30% on hit recall

**If player detection is the bottleneck:**
- Try a larger YOLO model first (zero labeling effort)
- Fine-tune YOLO if needed (requires bounding box labels)

**If shot classification is the bottleneck:**
- Tune the heuristic thresholds per shot type
- Consider training a small classifier (see section below)

### Phase 4: Ongoing improvement (continuous)

After each real match you analyze:
1. Quickly review the pipeline output in the app
2. Correct any obvious errors (the app lets you edit shots)
3. These corrections become new ground-truth data
4. Periodically re-evaluate metrics using the growing dataset

---

## 7. Time investment summary

| Activity | One-time? | Time | Payoff |
|----------|-----------|------|--------|
| Selecting evaluation/tuning clips | One-time | 30 min | Foundation for everything |
| Labeling rally boundaries (6 clips) | One-time | 2 hours | Enables rally metrics |
| Labeling shot events (6 clips) | One-time | 3 hours | Enables shot metrics |
| Running the pipeline | Per iteration | 15–30 min | Generates predictions |
| Running evaluation script | Per iteration | 1 min | Generates scores |
| Threshold grid search | One-time | 2–3 hours | Quick accuracy gains |
| Fine-tuning TrackNet | One-time + periodic | 1–2 days (labeling + training) | Major hit detection improvement |
| Fine-tuning YOLO | One-time + periodic | 1–2 days (labeling + training) | Better player detection |
| Training shot classifier | Optional | 2–3 days | Better shot type accuracy |
| Reviewing pipeline output after matches | Ongoing | 10 min per match | Grows your dataset for free |

---

## 8. Appendix: scripts and tooling

### Evaluation script structure

Create `cv_service/eval/evaluate.py` to automate the comparison between predictions and ground truth. The core logic:

```python
"""
Usage:
    python eval/evaluate.py \
        --ground-truth eval/ground_truth/ \
        --predictions eval/predictions/ \
        --output eval/results/run_XYZ.json
"""

import json
import argparse
from pathlib import Path
from collections import Counter


def match_rallies(gt_rallies, pred_rallies, tolerance_sec=2.0):
    """Match ground-truth rallies to predicted rallies by time overlap."""
    matches = []
    used_pred = set()
    for gt in gt_rallies:
        best_match = None
        best_overlap = 0
        for i, pred in enumerate(pred_rallies):
            if i in used_pred:
                continue
            overlap_start = max(gt["start_sec"], pred["start_sec"])
            overlap_end = min(gt["end_sec"], pred["end_sec"])
            overlap = max(0, overlap_end - overlap_start)
            gt_duration = gt["end_sec"] - gt["start_sec"]
            if overlap > 0.5 * gt_duration and overlap > best_overlap:
                best_overlap = overlap
                best_match = i
        if best_match is not None:
            matches.append((gt, pred_rallies[best_match]))
            used_pred.add(best_match)
        else:
            matches.append((gt, None))
    return matches


def match_shots(gt_shots, pred_shots, tolerance_sec=0.5):
    """Match ground-truth shots to predicted shots by timestamp proximity."""
    matches = []
    used_pred = set()
    for gt_shot in gt_shots:
        best_idx = None
        best_delta = float("inf")
        for i, pred_shot in enumerate(pred_shots):
            if i in used_pred:
                continue
            delta = abs(gt_shot["timestamp"] - pred_shot["timestamp"])
            if delta < tolerance_sec and delta < best_delta:
                best_delta = delta
                best_idx = i
        if best_idx is not None:
            matches.append((gt_shot, pred_shots[best_idx]))
            used_pred.add(best_idx)
        else:
            matches.append((gt_shot, None))
    return matches


def compute_metrics(gt_path, pred_path):
    """Compute all metrics for one clip."""
    gt = json.loads(Path(gt_path).read_text())
    pred = json.loads(Path(pred_path).read_text())

    gt_rallies = gt["rallies"]
    pred_rallies = pred.get("rallies", [])

    # Rally-level metrics
    rally_matches = match_rallies(gt_rallies, pred_rallies)
    rally_recall = sum(1 for _, p in rally_matches if p is not None) / max(len(gt_rallies), 1)
    rally_precision = sum(1 for _, p in rally_matches if p is not None) / max(len(pred_rallies), 1)
    rally_f1 = (2 * rally_precision * rally_recall / max(rally_precision + rally_recall, 1e-9))

    rally_count_err = abs(len(pred_rallies) - len(gt_rallies)) / max(len(gt_rallies), 1)

    # Shot-level metrics (within matched rallies)
    total_shots_matched = 0
    shot_type_correct = 0
    shot_type_counts = Counter()

    for gt_rally, pred_rally in rally_matches:
        if pred_rally is None:
            continue
        gt_shots = gt_rally.get("shots", [])
        pred_shots = pred_rally.get("shots", [])
        shot_matches = match_shots(gt_shots, pred_shots)

        for gt_shot, pred_shot in shot_matches:
            if pred_shot is not None:
                total_shots_matched += 1
                gt_type = gt_shot["shot_type"]
                pred_type = pred_shot["shot_type"]
                shot_type_counts[(gt_type, pred_type)] += 1
                if gt_type == pred_type:
                    shot_type_correct += 1

    shot_type_acc = shot_type_correct / max(total_shots_matched, 1)

    return {
        "rally_count_gt": len(gt_rallies),
        "rally_count_pred": len(pred_rallies),
        "rally_count_error": rally_count_err,
        "rally_precision": rally_precision,
        "rally_recall": rally_recall,
        "rally_f1": rally_f1,
        "shots_matched": total_shots_matched,
        "shot_type_accuracy": shot_type_acc,
        "shot_type_confusion": dict(
            (f"{gt}->{pred}", count) for (gt, pred), count in shot_type_counts.items()
        ),
    }
```

### Pipeline runner for evaluation

Create `cv_service/eval/run_eval.py`:

```python
"""
Run the pipeline on a clip and save predictions in the ground-truth format.

Usage:
    python eval/run_eval.py \
        --video path/to/clip.mp4 \
        --ground-truth eval/ground_truth/clip_001.json \
        --output eval/predictions/clip_001.json
"""

import json
import argparse
from pathlib import Path
from models import AnalyzeRequest, CourtCalibration, Point2D, Side
from pipeline import run_pipeline


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--ground-truth", required=True,
                        help="Ground truth JSON (used to get calibration data)")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    gt = json.loads(Path(args.ground_truth).read_text())
    cal_data = gt.get("calibration")

    calibration = None
    if cal_data:
        calibration = CourtCalibration(
            top_left=Point2D(**cal_data["top_left"]),
            top_right=Point2D(**cal_data["top_right"]),
            bottom_right=Point2D(**cal_data["bottom_right"]),
            bottom_left=Point2D(**cal_data["bottom_left"]),
            near_side=Side(cal_data.get("near_side", "me")),
        )

    request = AnalyzeRequest(
        video_path=args.video,
        match_id=0,
        calibration=calibration,
    )

    def progress(msg, pct):
        print(f"  [{pct:.0%}] {msg}")

    result = run_pipeline(request, on_progress=progress)

    output = {
        "video_path": args.video,
        "rallies": []
    }
    for rally in result.rallies:
        rally_out = {
            "start_sec": rally.shots[0].timestamp if rally.shots else 0,
            "end_sec": rally.shots[-1].timestamp if rally.shots else 0,
            "won_by_me": rally.won_by_me,
            "shots": [
                {
                    "timestamp": s.timestamp,
                    "shot_type": s.shot_type.value,
                    "player": s.player.value,
                    "zone_from": s.zone_from.value,
                    "zone_to": s.zone_to.value,
                    "outcome": s.outcome.value,
                }
                for s in rally.shots
            ]
        }
        output["rallies"].append(rally_out)

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(output, indent=2))
    print(f"\nSaved predictions to {args.output}")
    print(f"  {result.rally_count} rallies, {result.shot_count} shots")


if __name__ == "__main__":
    main()
```

### Threshold grid search script

Create `cv_service/eval/grid_search.py`:

```python
"""
Grid search over key thresholds to find the best config.

Usage:
    python eval/grid_search.py \
        --ground-truth-dir eval/ground_truth/ \
        --output eval/results/grid_search.json
"""

import json
import itertools
from pathlib import Path
from config import settings
from models import AnalyzeRequest, CourtCalibration, Point2D, Side
from pipeline import run_pipeline


PARAM_GRID = {
    "hit_angle_change_deg": [40.0, 50.0, 60.0, 70.0, 80.0],
    "rally_gap_seconds": [2.0, 3.0, 4.0, 5.0],
    "shuttle_conf_threshold": [0.3, 0.4, 0.5, 0.6],
    "player_conf_threshold": [0.3, 0.4, 0.5],
    "hit_min_gap_frames": [3, 5, 8],
}


def run_with_config(config, gt_dir):
    """Run pipeline on all ground-truth clips with the given config."""
    for key, value in config.items():
        setattr(settings, key, value)

    gt_files = sorted(Path(gt_dir).glob("*.json"))
    all_metrics = []
    for gt_file in gt_files:
        gt = json.loads(gt_file.read_text())
        cal_data = gt.get("calibration")
        calibration = None
        if cal_data:
            calibration = CourtCalibration(
                top_left=Point2D(**cal_data["top_left"]),
                top_right=Point2D(**cal_data["top_right"]),
                bottom_right=Point2D(**cal_data["bottom_right"]),
                bottom_left=Point2D(**cal_data["bottom_left"]),
                near_side=Side(cal_data.get("near_side", "me")),
            )

        request = AnalyzeRequest(
            video_path=gt["video_path"],
            match_id=0,
            calibration=calibration,
        )

        try:
            result = run_pipeline(request, on_progress=lambda m, p: None)
            all_metrics.append({
                "clip": gt_file.stem,
                "rally_count_gt": len(gt["rallies"]),
                "rally_count_pred": result.rally_count,
                "shot_count_pred": result.shot_count,
            })
        except Exception as e:
            all_metrics.append({"clip": gt_file.stem, "error": str(e)})

    return all_metrics


def grid_search(gt_dir, output_path):
    keys = list(PARAM_GRID.keys())
    values = list(PARAM_GRID.values())
    results = []

    for combo in itertools.product(*values):
        config = dict(zip(keys, combo))
        print(f"Testing: {config}")
        metrics = run_with_config(config, gt_dir)
        results.append({"config": config, "metrics": metrics})

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(results, indent=2))
    print(f"Grid search complete. {len(results)} configs tested.")
    print(f"Results saved to {output_path}")
```

Note: a full grid search over all parameter combinations is expensive (hundreds of pipeline runs). In practice, start with a coarse grid (fewer values per parameter), identify which parameters matter most, then do a fine search on just those 1–2 parameters.

### Fine-tuning YOLO for player detection

If player detection is the bottleneck, fine-tune the YOLO model on your footage:

**Step 1: Label training data**

Export frames from your videos and label player bounding boxes using [Roboflow](https://roboflow.com/) (free tier works), [CVAT](https://cvat.ai/), or [Label Studio](https://labelstud.io/).

Target: 500–1000 labeled frames with bounding boxes around all court players.

Export in YOLO format:
```
datasets/
├── train/
│   ├── images/
│   │   ├── frame_001.jpg
│   │   └── ...
│   └── labels/
│       ├── frame_001.txt
│       └── ...
├── val/
│   ├── images/
│   └── labels/
└── data.yaml
```

`data.yaml`:
```yaml
train: datasets/train/images
val: datasets/val/images
nc: 1
names: ['player']
```

**Step 2: Fine-tune**

```python
from ultralytics import YOLO

model = YOLO("yolo11n.pt")  # start from pre-trained
results = model.train(
    data="datasets/data.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    project="runs/player_detect",
    name="finetune_v1",
)

# Best weights saved to runs/player_detect/finetune_v1/weights/best.pt
# Copy to cv_service/ and update CV_YOLO_DETECT_MODEL
```

**Step 3: Evaluate**

```bash
# Update config
export CV_YOLO_DETECT_MODEL=runs/player_detect/finetune_v1/weights/best.pt

# Re-run pipeline on evaluation clips
python eval/run_eval.py --video clip.mp4 --ground-truth eval/ground_truth/clip.json \
  --output eval/predictions/clip_finetuned.json
```

### Fine-tuning TrackNetV3

This gives the biggest accuracy improvement but requires the most labeling effort.

**Step 1: Label shuttle positions**

For each training frame, you need the (x, y) pixel position of the shuttle, or "not visible" if it's not in the frame.

The TrackNetV3 repo includes a labeling format. Create CSV files:

```csv
frame_num,visibility,x,y
0,0,0,0
1,1,342,156
2,1,338,161
3,0,0,0
```

Where visibility: 0 = not visible, 1 = visible.

**Labeling approach:** Use a frame viewer script. Step through frames one by one and click the shuttle position. This is tedious (~5–10 seconds per frame). For 1000 frames, budget 2–3 hours.

**Step 2: Train**

Follow the [TrackNetV3 repo training instructions](https://github.com/qaz812345/TrackNetV3). The key command:

```bash
cd cv_service/vendor/TrackNetV3
python train.py \
    --data_dir /path/to/labeled/data \
    --epochs 30 \
    --batch_size 8 \
    --save_dir /path/to/output
```

**Step 3: Deploy**

Copy the best checkpoint to `cv_service/weights/tracknetv3.pt` (overwrite the old one).

### Replacing heuristic shot classification with ML

If shot classification accuracy plateaus below 65–70% with heuristic tuning, consider training a small classifier:

**Input features per shot:**
- Shuttle speed (m/s)
- Shuttle trajectory angle (degrees)
- Travel distance (meters)
- Shuttle height change (if available from trajectory)
- Distance from net of hit point
- Player court position at hit time

**Architecture:** A simple model works — Random Forest, XGBoost, or a 2-layer MLP. Badminton has only 8 shot types; you don't need a large model.

**Training data:** Your ground-truth shot labels + the feature vectors extracted by the pipeline.

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
import numpy as np

# X: (n_shots, n_features) array of feature vectors
# y: (n_shots,) array of shot type labels

clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)
print(classification_report(y_test, clf.predict(X_test)))

# Save model
import joblib
joblib.dump(clf, "cv_service/weights/shot_classifier.pkl")
```

This only becomes worth the effort once you have 200+ labeled shots.
