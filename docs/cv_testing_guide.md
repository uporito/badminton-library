# CV Pipeline — Testing Guide

This document provides a systematic test plan for every component of the Phase 5 CV video analysis pipeline. Tests are organized from the lowest-level pure-logic units (which need no models, no video, no GPU) up through integration tests that exercise the full stack.

---

## Table of contents

1. [Testing strategy overview](#1-testing-strategy-overview)
2. [Prerequisites](#2-prerequisites)
3. [Layer 0: Python environment & imports](#3-layer-0-python-environment--imports)
4. [Layer 1: Pydantic models & enums](#4-layer-1-pydantic-models--enums)
5. [Layer 2: Job store](#5-layer-2-job-store)
6. [Layer 3: Court detection & homography (pure math)](#6-layer-3-court-detection--homography-pure-math)
7. [Layer 4: Hit detection (pure math)](#7-layer-4-hit-detection-pure-math)
8. [Layer 5: Rally segmentation (pure logic)](#8-layer-5-rally-segmentation-pure-logic)
9. [Layer 6: Shot classification (pure heuristics)](#9-layer-6-shot-classification-pure-heuristics)
10. [Layer 7: Pose estimation utilities (pure math)](#10-layer-7-pose-estimation-utilities-pure-math)
11. [Layer 8: Model loading & inference smoke tests](#11-layer-8-model-loading--inference-smoke-tests)
12. [Layer 9: Scene cut detection](#12-layer-9-scene-cut-detection)
13. [Layer 10: FastAPI service integration](#13-layer-10-fastapi-service-integration)
14. [Layer 11: Next.js API route integration](#14-layer-11-nextjs-api-route-integration)
15. [Layer 12: End-to-end pipeline](#15-layer-12-end-to-end-pipeline)
16. [Test summary matrix](#16-test-summary-matrix)

---

## 1. Testing strategy overview

The pipeline has three distinct categories of testability:

| Category | What it covers | Can unit test with synthetic data? | Needs real video / GPU? |
|----------|---------------|-----------------------------------|------------------------|
| **Pure logic** | Models, job store, homography math, hit detection algorithm, rally segmentation, shot classification heuristics, pose utilities | Yes — fully testable now | No |
| **Model loading & inference** | YOLO detection, YOLO-Pose, TrackNetV3, PySceneDetect | Partially — can verify models load and produce output on a synthetic frame | YOLO models auto-download (~6 MB); TrackNetV3 needs manual setup |
| **Integration** | FastAPI endpoints, Next.js proxy, DB writes, frontend polling | Yes — can test HTTP contracts and data flow | Needs both services running |

**Guiding principle:** test the logic exhaustively with synthetic data first. For ML models that are pre-trained (YOLO) or require manual setup (TrackNetV3), verify they load, accept input, and produce structurally valid output — not that the output is semantically correct for badminton. Semantic accuracy testing comes later with labeled test videos.

### Test frameworks

| Stack | Framework | Config |
|-------|-----------|--------|
| Python (`cv_service/`) | **pytest** | To be added (see [Prerequisites](#2-prerequisites)) |
| TypeScript (`src/`) | **Vitest** | Already configured in `vitest.config.ts` |

---

## 2. Prerequisites

### 2.1 Install pytest in the Python venv

```bash
cd cv_service
# Activate your venv first
pip install pytest pytest-asyncio httpx
```

> `httpx` is needed for FastAPI's `TestClient`. `pytest-asyncio` for async test support.

### 2.2 Test video file (for Layers 8+)

Many integration tests need a short video file. You have two options:

**Option A — Generate a synthetic test video (no real footage needed):**

```python
# Run once to create cv_service/tests/fixtures/test_video.mp4
import cv2
import numpy as np
from pathlib import Path

out_dir = Path("cv_service/tests/fixtures")
out_dir.mkdir(parents=True, exist_ok=True)

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(str(out_dir / "test_video.mp4"), fourcc, 30.0, (640, 480))

for i in range(150):  # 5 seconds at 30fps
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Draw a green rectangle as a fake court
    cv2.rectangle(frame, (100, 50), (540, 430), (0, 255, 0), 2)
    # Draw a moving white circle as a fake player
    cx = 200 + int(100 * np.sin(i * 0.1))
    cy = 240 + int(50 * np.cos(i * 0.1))
    cv2.circle(frame, (cx, cy), 20, (255, 255, 255), -1)
    writer.write(frame)

writer.release()
print("Created test_video.mp4")
```

**Option B — Use a real short clip:** Place any short badminton clip (5-30 seconds) at `cv_service/tests/fixtures/test_video.mp4`.

### 2.3 Directory structure for tests

```
cv_service/
├── tests/
│   ├── __init__.py
│   ├── conftest.py              ← shared fixtures
│   ├── fixtures/
│   │   └── test_video.mp4       ← synthetic or real
│   ├── test_models.py           ← Layer 1
│   ├── test_job_store.py        ← Layer 2
│   ├── test_court_detection.py  ← Layer 3
│   ├── test_hit_detection.py    ← Layer 4
│   ├── test_rally_segmentation.py ← Layer 5
│   ├── test_shot_classification.py ← Layer 6
│   ├── test_pose_utils.py       ← Layer 7
│   ├── test_model_loading.py    ← Layer 8
│   ├── test_scene_cut.py        ← Layer 9
│   └── test_api.py              ← Layer 10
```

---

## 3. Layer 0: Python environment & imports

**What it tests:** All dependencies are installed, all modules import without error.

**How to run:**

```bash
cd cv_service
python -c "
import fastapi; print(f'fastapi {fastapi.__version__}')
import pydantic; print(f'pydantic {pydantic.__version__}')
import cv2; print(f'opencv {cv2.__version__}')
import numpy; print(f'numpy {numpy.__version__}')
import torch; print(f'torch {torch.__version__}, CUDA: {torch.cuda.is_available()}')
import ultralytics; print(f'ultralytics {ultralytics.__version__}')
import scenedetect; print(f'scenedetect {scenedetect.__version__}')
import scipy; print(f'scipy {scipy.__version__}')
from pydantic_settings import BaseSettings; print('pydantic-settings OK')
"
```

Then verify all project modules import:

```bash
cd cv_service
python -c "
import config; print('config OK')
import models; print('models OK')
import job_store; print('job_store OK')
import pipeline; print('pipeline OK')
import stages.scene_cut; print('stages.scene_cut OK')
import stages.court_detection; print('stages.court_detection OK')
import stages.player_detection; print('stages.player_detection OK')
import stages.shuttle_tracking; print('stages.shuttle_tracking OK')
import stages.pose_estimation; print('stages.pose_estimation OK')
import stages.hit_detection; print('stages.hit_detection OK')
import stages.shot_classification; print('stages.shot_classification OK')
import stages.rally_segmentation; print('stages.rally_segmentation OK')
print('All imports OK')
"
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 0.1 | All `pip` packages import | All version strings print | Any `ModuleNotFoundError` |
| 0.2 | All project modules import | "All imports OK" prints | Any `ImportError` or `SyntaxError` |
| 0.3 | PyTorch reports CUDA status | Prints `CUDA: True` or `CUDA: False` (both acceptable, True preferred) | Torch fails to import |

---

## 4. Layer 1: Pydantic models & enums

**What it tests:** All Pydantic models can be instantiated, serialized to JSON, and deserialized. Enum values match the TypeScript schema.

**File:** `cv_service/tests/test_models.py`

**Tests to write:**

```python
# test_models.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import (
    ShotType, Side, Zone, Outcome, ShotPlayer, JobStatus,
    Point2D, CourtCalibration, AnalyzeRequest, ShotResult,
    RallyResult, AnalysisOutput, JobInfo,
    PlayerBox, ShuttlePosition, Keypoints, HitEvent, FrameData,
)


class TestEnums:
    def test_shot_type_values(self):
        expected = {"serve", "clear", "smash", "drop", "drive", "lift", "net", "block"}
        assert {e.value for e in ShotType} == expected

    def test_zone_has_9_values(self):
        assert len(Zone) == 9

    def test_side_values(self):
        assert {e.value for e in Side} == {"me", "opponent"}

    def test_outcome_values(self):
        assert {e.value for e in Outcome} == {"winner", "error", "neither"}

    def test_shot_player_values(self):
        assert {e.value for e in ShotPlayer} == {"me", "partner", "opponent"}

    def test_job_status_values(self):
        assert {e.value for e in JobStatus} == {"queued", "running", "completed", "failed"}


class TestModels:
    def test_point2d_roundtrip(self):
        p = Point2D(x=1.5, y=2.5)
        data = p.model_dump_json()
        p2 = Point2D.model_validate_json(data)
        assert p2.x == 1.5 and p2.y == 2.5

    def test_court_calibration_defaults(self):
        cal = CourtCalibration(
            top_left=Point2D(x=0, y=0),
            top_right=Point2D(x=100, y=0),
            bottom_right=Point2D(x=100, y=200),
            bottom_left=Point2D(x=0, y=200),
        )
        assert cal.near_side == Side.me

    def test_analyze_request_minimal(self):
        req = AnalyzeRequest(video_path="/tmp/test.mp4", match_id=1)
        assert req.calibration is None
        assert req.fps_override is None

    def test_shot_result_json_roundtrip(self):
        shot = ShotResult(
            shot_type=ShotType.smash,
            player=ShotPlayer.me,
            zone_from_side=Side.me,
            zone_from=Zone.center_back,
            zone_to_side=Side.opponent,
            zone_to=Zone.center_front,
            outcome=Outcome.winner,
            timestamp=12.5,
        )
        data = shot.model_dump_json()
        shot2 = ShotResult.model_validate_json(data)
        assert shot2.shot_type == ShotType.smash
        assert shot2.timestamp == 12.5

    def test_analysis_output_empty(self):
        out = AnalysisOutput(rallies=[], rally_count=0, shot_count=0)
        assert out.rallies == []

    def test_job_info_full_lifecycle(self):
        info = JobInfo(job_id="abc123", status=JobStatus.queued)
        assert info.progress is None
        assert info.result is None

    def test_frame_data_defaults(self):
        fd = FrameData(frame_idx=0, timestamp=0.0)
        assert fd.players == []
        assert fd.shuttle is None
        assert fd.keypoints == []

    def test_player_box_with_court_pos(self):
        pb = PlayerBox(
            track_id=1,
            bbox=(10.0, 20.0, 50.0, 100.0),
            center=Point2D(x=30.0, y=60.0),
            court_pos=Point2D(x=3.0, y=6.0),
            side=Side.me,
        )
        assert pb.side == Side.me

    def test_hit_event_minimal(self):
        he = HitEvent(frame_idx=100, timestamp=3.33)
        assert he.player_track_id is None
        assert he.shuttle_px is None
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_models.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 1.1 | All enum values match TypeScript schema | All `test_*_values` pass | Any mismatch |
| 1.2 | All models serialize/deserialize | All `*_roundtrip` tests pass | `ValidationError` on any model |
| 1.3 | Default values are correct | `near_side` defaults to `me`, optional fields default to `None` | Wrong default |

---

## 5. Layer 2: Job store

**What it tests:** Job creation, retrieval, update lifecycle, and file persistence.

**File:** `cv_service/tests/test_job_store.py`

**Tests to write:**

```python
# test_job_store.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile
from pathlib import Path
from unittest.mock import patch
from config import settings
from models import JobStatus, AnalysisOutput
from job_store import create_job, get_job, update_job


class TestJobStore:
    def setup_method(self):
        """Use a temp directory for each test to avoid cross-contamination."""
        self._tmpdir = tempfile.mkdtemp()
        self._orig = settings.jobs_dir
        settings.jobs_dir = Path(self._tmpdir)

    def teardown_method(self):
        settings.jobs_dir = self._orig

    def test_create_job_returns_id(self):
        job_id = create_job()
        assert isinstance(job_id, str)
        assert len(job_id) == 12

    def test_create_job_writes_file(self):
        job_id = create_job()
        p = Path(self._tmpdir) / f"{job_id}.json"
        assert p.exists()

    def test_get_job_returns_queued(self):
        job_id = create_job()
        info = get_job(job_id)
        assert info is not None
        assert info.status == JobStatus.queued
        assert info.job_id == job_id

    def test_get_nonexistent_returns_none(self):
        assert get_job("nonexistent") is None

    def test_update_status(self):
        job_id = create_job()
        update_job(job_id, status=JobStatus.running)
        info = get_job(job_id)
        assert info.status == JobStatus.running

    def test_update_progress(self):
        job_id = create_job()
        update_job(job_id, progress="Stage 1...", progress_pct=0.25)
        info = get_job(job_id)
        assert info.progress == "Stage 1..."
        assert info.progress_pct == 0.25

    def test_update_preserves_unset_fields(self):
        job_id = create_job()
        update_job(job_id, status=JobStatus.running, progress="Starting")
        update_job(job_id, progress_pct=0.5)
        info = get_job(job_id)
        assert info.status == JobStatus.running
        assert info.progress == "Starting"
        assert info.progress_pct == 0.5

    def test_update_with_result(self):
        job_id = create_job()
        result = AnalysisOutput(rallies=[], rally_count=0, shot_count=0)
        update_job(job_id, status=JobStatus.completed, result=result)
        info = get_job(job_id)
        assert info.status == JobStatus.completed
        assert info.result is not None
        assert info.result.rally_count == 0

    def test_update_with_error(self):
        job_id = create_job()
        update_job(job_id, status=JobStatus.failed, error="Boom")
        info = get_job(job_id)
        assert info.status == JobStatus.failed
        assert info.error == "Boom"

    def test_update_nonexistent_is_noop(self):
        update_job("ghost", status=JobStatus.running)  # should not raise
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_job_store.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 2.1 | Job CRUD lifecycle works | Create → get → update → get returns expected data | Any assertion error |
| 2.2 | Files are persisted to disk | `.json` file exists after `create_job` | File missing |
| 2.3 | Partial updates don't overwrite other fields | Updating `progress_pct` alone preserves `status` and `progress` | Field reset to None |
| 2.4 | Nonexistent job returns `None` / is no-op | `get_job("x")` returns `None`, `update_job("x")` doesn't raise | Exception thrown |

---

## 6. Layer 3: Court detection & homography (pure math)

**What it tests:** Homography computation, pixel-to-court mapping, court-to-zone classification, side assignment. All pure math — no video or models needed.

**File:** `cv_service/tests/test_court_detection.py`

**Tests to write:**

```python
# test_court_detection.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import math
from models import CourtCalibration, Point2D, Side, Zone
from stages.court_detection import (
    compute_homography, player_side_from_court_pos, _reference_corners,
)


def _make_calibration(near_side="me"):
    """Simplest calibration: pixel coords = court coords * 100 (no perspective)."""
    return CourtCalibration(
        top_left=Point2D(x=0, y=0),
        top_right=Point2D(x=610, y=0),
        bottom_right=Point2D(x=610, y=1340),
        bottom_left=Point2D(x=0, y=1340),
        near_side=Side(near_side),
    )


class TestReferenceCorners:
    def test_shape(self):
        ref = _reference_corners()
        assert ref.shape == (4, 2)

    def test_dimensions(self):
        ref = _reference_corners()
        assert ref[1, 0] == 6.1    # court_width
        assert ref[2, 1] == 13.4   # court_length


class TestComputeHomography:
    def test_returns_homography(self):
        H = compute_homography(_make_calibration())
        assert H.matrix.shape == (3, 3)
        assert H.inv_matrix.shape == (3, 3)

    def test_near_side_stored(self):
        H = compute_homography(_make_calibration("opponent"))
        assert H.near_side == Side.opponent

    def test_court_dimensions_stored(self):
        H = compute_homography(_make_calibration())
        assert H.court_width == 6.1
        assert H.court_length == 13.4
        assert H.half_court == 6.7


class TestPixelToCourtMapping:
    def test_corners_map_correctly(self):
        """With a simple linear calibration, corners should map to reference."""
        H = compute_homography(_make_calibration())
        # top-left pixel (0,0) → court (0,0)
        cx, cy = H.pixel_to_court(0, 0)
        assert abs(cx) < 0.5
        assert abs(cy) < 0.5

        # bottom-right pixel (610, 1340) → court (6.1, 13.4)
        cx, cy = H.pixel_to_court(610, 1340)
        assert abs(cx - 6.1) < 0.5
        assert abs(cy - 13.4) < 0.5

    def test_center_maps_to_center(self):
        H = compute_homography(_make_calibration())
        cx, cy = H.pixel_to_court(305, 670)
        assert abs(cx - 3.05) < 0.5
        assert abs(cy - 6.7) < 0.5

    def test_roundtrip(self):
        """pixel → court → pixel should return approximately the same point."""
        H = compute_homography(_make_calibration())
        px, py = 200.0, 500.0
        cx, cy = H.pixel_to_court(px, py)
        px2, py2 = H.court_to_pixel(cx, cy)
        assert abs(px2 - px) < 1.0
        assert abs(py2 - py) < 1.0


class TestCourtToZone:
    def test_near_side_me_baseline(self):
        """Near baseline (y=13.0) with near_side=me should be Side.me, *_back."""
        H = compute_homography(_make_calibration("me"))
        side, zone = H.court_to_zone(3.0, 13.0)
        assert side == Side.me
        assert "back" in zone.value

    def test_far_side_net(self):
        """Far side near net (y=0.5) with near_side=me should be Side.opponent, *_front."""
        H = compute_homography(_make_calibration("me"))
        side, zone = H.court_to_zone(3.0, 0.5)
        assert side == Side.opponent
        assert "front" in zone.value

    def test_left_center_right(self):
        """Test lateral zone assignment across the court."""
        H = compute_homography(_make_calibration())
        _, zone_left = H.court_to_zone(0.5, 10.0)
        _, zone_center = H.court_to_zone(3.0, 10.0)
        _, zone_right = H.court_to_zone(5.5, 10.0)
        assert "left" in zone_left.value
        assert "center" in zone_center.value
        assert "right" in zone_right.value

    def test_all_9_zones_reachable(self):
        """Sampling the 9 grid cells should produce all 9 unique zone values."""
        H = compute_homography(_make_calibration())
        zones_seen = set()
        third_x = 6.1 / 3
        third_y = 6.7 / 3
        for xi in range(3):
            for yi in range(3):
                x = third_x * xi + third_x / 2
                y = third_y * yi + third_y / 2  # stays in near half
                _, zone = H.court_to_zone(x, y)
                zones_seen.add(zone)
        assert len(zones_seen) == 9

    def test_clamping_out_of_bounds(self):
        """Coordinates outside court should be clamped, not crash."""
        H = compute_homography(_make_calibration())
        side, zone = H.court_to_zone(-5.0, 20.0)
        assert isinstance(side, Side)
        assert isinstance(zone, Zone)


class TestPlayerSideFromCourtPos:
    def test_near_half_is_me(self):
        H = compute_homography(_make_calibration("me"))
        assert player_side_from_court_pos(10.0, H) == Side.me

    def test_far_half_is_opponent(self):
        H = compute_homography(_make_calibration("me"))
        assert player_side_from_court_pos(3.0, H) == Side.opponent

    def test_swapped_when_near_is_opponent(self):
        H = compute_homography(_make_calibration("opponent"))
        assert player_side_from_court_pos(10.0, H) == Side.opponent
        assert player_side_from_court_pos(3.0, H) == Side.me
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_court_detection.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 3.1 | Homography is a valid 3x3 matrix | Shape is (3,3), no NaN | Shape wrong or NaN values |
| 3.2 | Corner pixels map to court reference corners | Error < 0.5m | Large error or exception |
| 3.3 | Pixel→court→pixel roundtrip | Error < 1 pixel | Large drift |
| 3.4 | All 9 zones are reachable | 9 distinct zones from 9 grid samples | Missing zones |
| 3.5 | Side assignment respects `near_side` | Near half → near_side player, far half → other | Sides swapped |
| 3.6 | Out-of-bounds coordinates clamp | Returns valid Side/Zone, no crash | Exception |

---

## 7. Layer 4: Hit detection (pure math)

**What it tests:** The trajectory-based angle change algorithm and the pose-based fallback, using synthetic frame data (no real video or models).

**File:** `cv_service/tests/test_hit_detection.py`

**Tests to write:**

```python
# test_hit_detection.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import FrameData, ShuttlePosition, Point2D, PlayerBox, Side, Keypoints
from stages.hit_detection import (
    detect_hits_from_trajectory,
    detect_hits_from_poses,
    _find_nearest_player,
)


def _make_fd(idx, ts, sx=None, sy=None, players=None, keypoints=None):
    shuttle = ShuttlePosition(x=sx, y=sy) if sx is not None else None
    return FrameData(
        frame_idx=idx,
        timestamp=ts,
        shuttle=shuttle,
        players=players or [],
        keypoints=keypoints or [],
    )


class TestTrajectoryHitDetection:
    def test_no_shuttle_data(self):
        """Empty shuttle data should return no hits."""
        frames = [_make_fd(i, i / 30.0) for i in range(100)]
        hits = detect_hits_from_trajectory(frames)
        assert hits == []

    def test_straight_line_no_hits(self):
        """Shuttle moving in a straight line should produce no hits (no direction change)."""
        frames = [_make_fd(i, i / 30.0, sx=float(i), sy=0.0) for i in range(100)]
        hits = detect_hits_from_trajectory(frames)
        assert len(hits) == 0

    def test_reversal_produces_hit(self):
        """Shuttle going right then sharply left should produce a hit."""
        frames = []
        for i in range(20):
            frames.append(_make_fd(i, i / 30.0, sx=float(i * 10), sy=100.0))
        for i in range(20, 40):
            frames.append(_make_fd(i, i / 30.0, sx=float((40 - i) * 10), sy=100.0))
        hits = detect_hits_from_trajectory(frames, angle_threshold_deg=60)
        assert len(hits) >= 1

    def test_multiple_reversals(self):
        """Zigzag trajectory should produce multiple hits."""
        frames = []
        for i in range(100):
            if (i // 15) % 2 == 0:
                x = float(i * 10)
            else:
                x = float((30 - (i % 15)) * 10)
            frames.append(_make_fd(i, i / 30.0, sx=x, sy=200.0))
        hits = detect_hits_from_trajectory(frames, angle_threshold_deg=45, min_gap_frames=3)
        assert len(hits) >= 2

    def test_min_gap_debounce(self):
        """Two quick reversals within min_gap should only produce one hit."""
        frames = []
        for i in range(10):
            frames.append(_make_fd(i, i / 30.0, sx=float(i * 20), sy=0.0))
        frames.append(_make_fd(10, 10 / 30.0, sx=160.0, sy=0.0))
        frames.append(_make_fd(11, 11 / 30.0, sx=180.0, sy=0.0))
        frames.append(_make_fd(12, 12 / 30.0, sx=140.0, sy=0.0))
        hits = detect_hits_from_trajectory(frames, min_gap_frames=20)
        assert len(hits) <= 1

    def test_hit_has_timestamp(self):
        frames = []
        for i in range(15):
            frames.append(_make_fd(i, i / 30.0, sx=float(i * 10), sy=100.0))
        for i in range(15, 30):
            frames.append(_make_fd(i, i / 30.0, sx=float((30 - i) * 10), sy=100.0))
        hits = detect_hits_from_trajectory(frames, angle_threshold_deg=60)
        if hits:
            assert hits[0].timestamp > 0
            assert hits[0].frame_idx > 0


class TestFindNearestPlayer:
    def test_returns_closest(self):
        p1 = PlayerBox(track_id=1, bbox=(0,0,20,40), center=Point2D(x=10, y=20), side=Side.me)
        p2 = PlayerBox(track_id=2, bbox=(200,0,220,40), center=Point2D(x=210, y=20), side=Side.opponent)
        fd = _make_fd(0, 0.0, sx=15.0, sy=25.0, players=[p1, p2])
        result = _find_nearest_player(fd)
        assert result is not None
        assert result[0] == 1  # track_id of closer player
        assert result[1] == Side.me

    def test_no_players(self):
        fd = _make_fd(0, 0.0, sx=100.0, sy=100.0)
        assert _find_nearest_player(fd) is None

    def test_no_shuttle(self):
        p1 = PlayerBox(track_id=1, bbox=(0,0,20,40), center=Point2D(x=10, y=20))
        fd = _make_fd(0, 0.0, players=[p1])
        assert _find_nearest_player(fd) is None
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_hit_detection.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 4.1 | No data → no hits | Returns `[]` | Non-empty or exception |
| 4.2 | Straight line → no hits | Returns `[]` | False positive hits |
| 4.3 | Sharp reversal → 1+ hit | At least 1 `HitEvent` | Empty list |
| 4.4 | Zigzag → multiple hits | At least 2 hits | Too few |
| 4.5 | Min gap debounce works | Rapid reversals collapse to 1 | Duplicate hits |
| 4.6 | Nearest player matched correctly | `track_id` of closest player returned | Wrong player |

---

## 8. Layer 5: Rally segmentation (pure logic)

**What it tests:** Grouping hits by time gap and filtering single-hit rallies.

**File:** `cv_service/tests/test_rally_segmentation.py`

**Tests to write:**

```python
# test_rally_segmentation.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import HitEvent, Side
from stages.rally_segmentation import segment_rallies, _determine_rally_winner
from models import ShotResult, ShotType, ShotPlayer, Zone, Outcome


def _hit(frame, ts, side=None):
    return HitEvent(frame_idx=frame, timestamp=ts, player_side=side)


class TestSegmentRallies:
    def test_empty_hits(self):
        assert segment_rallies([], {}, None) == []

    def test_single_hit_discarded(self):
        """Single-hit 'rallies' should be filtered as false positives."""
        hits = [_hit(0, 0.0)]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 0

    def test_continuous_hits_one_rally(self):
        """Hits within gap threshold form a single rally."""
        hits = [_hit(i * 30, i * 1.0) for i in range(10)]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 1
        assert len(rallies[0]) == 10

    def test_gap_splits_rallies(self):
        """A gap > threshold should split into two rallies."""
        hits = [
            _hit(0, 0.0), _hit(30, 1.0), _hit(60, 2.0),
            # 5-second gap
            _hit(210, 7.0), _hit(240, 8.0), _hit(270, 9.0),
        ]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 2
        assert len(rallies[0]) == 3
        assert len(rallies[1]) == 3

    def test_multiple_gaps(self):
        """Multiple gaps should produce multiple rallies."""
        hits = [
            _hit(0, 0.0), _hit(30, 1.0),  # rally 1
            _hit(200, 7.0), _hit(230, 8.0),  # rally 2
            _hit(400, 14.0), _hit(430, 15.0),  # rally 3
        ]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 3

    def test_single_hit_island_filtered(self):
        """A lone hit between two rallies should be discarded."""
        hits = [
            _hit(0, 0.0), _hit(30, 1.0),  # rally (2 hits)
            _hit(200, 7.0),  # lone hit
            _hit(400, 14.0), _hit(430, 15.0),  # rally (2 hits)
        ]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 2


class TestDetermineRallyWinner:
    def _shot(self, outcome, player):
        return ShotResult(
            shot_type=ShotType.clear,
            player=ShotPlayer(player),
            zone_from_side=Side.me, zone_from=Zone.center_mid,
            zone_to_side=Side.opponent, zone_to=Zone.center_mid,
            outcome=Outcome(outcome),
            timestamp=0.0,
        )

    def test_winner_by_me(self):
        shots = [self._shot("neither", "me"), self._shot("winner", "me")]
        assert _determine_rally_winner(shots) is True

    def test_winner_by_opponent(self):
        shots = [self._shot("neither", "me"), self._shot("winner", "opponent")]
        assert _determine_rally_winner(shots) is False

    def test_error_by_opponent_wins_for_me(self):
        shots = [self._shot("neither", "me"), self._shot("error", "opponent")]
        assert _determine_rally_winner(shots) is True

    def test_error_by_me_loses(self):
        shots = [self._shot("neither", "opponent"), self._shot("error", "me")]
        assert _determine_rally_winner(shots) is False

    def test_empty_shots(self):
        assert _determine_rally_winner([]) is False
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_rally_segmentation.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 5.1 | Empty input → empty output | `[]` | Non-empty or exception |
| 5.2 | Continuous hits → 1 rally | Exactly 1 rally group | Multiple groups |
| 5.3 | Gap splits rallies | 2 rally groups | Wrong count |
| 5.4 | Single-hit rallies filtered | Not present in output | Present |
| 5.5 | Winner determined by last shot outcome + player | All 4 cases correct | Wrong winner |

---

## 9. Layer 6: Shot classification (pure heuristics)

**What it tests:** The heuristic rules for classifying shots, determining zones, and determining outcomes. Uses synthetic `HitEvent` objects — no models needed.

**File:** `cv_service/tests/test_shot_classification.py`

**Tests to write:**

```python
# test_shot_classification.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import (
    HitEvent, FrameData, Point2D, Side, Zone, ShotType, Outcome, ShotPlayer,
)
from stages.shot_classification import (
    classify_shot_heuristic,
    determine_zones,
    determine_outcome_heuristic,
    hit_to_player,
    build_shot_result,
)
from stages.court_detection import compute_homography
from models import CourtCalibration


def _cal():
    return CourtCalibration(
        top_left=Point2D(x=0, y=0), top_right=Point2D(x=610, y=0),
        bottom_right=Point2D(x=610, y=1340), bottom_left=Point2D(x=0, y=1340),
    )


def _hit(ts, court_x=None, court_y=None, px_x=None, px_y=None, side=None):
    return HitEvent(
        frame_idx=int(ts * 30),
        timestamp=ts,
        player_side=side,
        shuttle_court=Point2D(x=court_x, y=court_y) if court_x is not None else None,
        shuttle_px=Point2D(x=px_x, y=px_y) if px_x is not None else None,
    )


class TestClassifyShotHeuristic:
    def test_first_in_rally_is_serve(self):
        hit = _hit(1.0, court_x=3.0, court_y=12.0)
        result = classify_shot_heuristic(hit, None, None, None, is_first_in_rally=True, rally_idx=0)
        assert result == ShotType.serve

    def test_no_court_data_defaults_to_clear(self):
        hit = _hit(2.0)
        prev = _hit(1.0)
        result = classify_shot_heuristic(hit, prev, None, None, is_first_in_rally=False, rally_idx=0)
        assert result == ShotType.clear

    def test_smash_high_speed_steep(self):
        """High speed + steep pixel angle → smash."""
        H = compute_homography(_cal())
        prev = _hit(1.0, court_x=3.0, court_y=1.0, px_x=305, px_y=100)
        hit = _hit(1.5, court_x=3.0, court_y=12.0, px_x=305, px_y=1200)
        result = classify_shot_heuristic(hit, prev, None, H, is_first_in_rally=False, rally_idx=0)
        assert result == ShotType.smash

    def test_net_shot_near_net_short_distance(self):
        H = compute_homography(_cal())
        prev = _hit(1.0, court_x=2.0, court_y=6.0, px_x=200, px_y=600)
        hit = _hit(1.5, court_x=2.5, court_y=7.0, px_x=250, px_y=700)
        result = classify_shot_heuristic(hit, prev, None, H, is_first_in_rally=False, rally_idx=0)
        assert result == ShotType.net

    def test_returns_valid_shot_type(self):
        """No matter what inputs, the result must be a valid ShotType."""
        H = compute_homography(_cal())
        for _ in range(20):
            import random
            prev = _hit(0.5, court_x=random.uniform(0, 6.1), court_y=random.uniform(0, 13.4),
                        px_x=random.uniform(0, 610), px_y=random.uniform(0, 1340))
            hit = _hit(1.0, court_x=random.uniform(0, 6.1), court_y=random.uniform(0, 13.4),
                       px_x=random.uniform(0, 610), px_y=random.uniform(0, 1340))
            result = classify_shot_heuristic(hit, prev, None, H, is_first_in_rally=False, rally_idx=0)
            assert isinstance(result, ShotType)


class TestDetermineZones:
    def test_no_homography_defaults(self):
        from_side, from_zone, to_side, to_zone = determine_zones(_hit(1.0), None, None)
        assert from_side == Side.me
        assert from_zone == Zone.center_mid
        assert to_side == Side.me
        assert to_zone == Zone.center_mid

    def test_with_homography_and_shuttle(self):
        H = compute_homography(_cal())
        prev = _hit(0.5, court_x=1.0, court_y=11.0)
        hit = _hit(1.0, court_x=5.0, court_y=2.0)
        from_side, from_zone, to_side, to_zone = determine_zones(hit, prev, H)
        assert isinstance(from_side, Side)
        assert isinstance(from_zone, Zone)
        assert isinstance(to_side, Side)
        assert isinstance(to_zone, Zone)


class TestDetermineOutcome:
    def test_not_last_shot_is_neither(self):
        hit = _hit(1.0, court_x=3.0, court_y=6.0)
        assert determine_outcome_heuristic(hit, _hit(2.0), is_last_in_rally=False, homography=None) == Outcome.neither

    def test_last_shot_in_bounds_is_winner(self):
        H = compute_homography(_cal())
        hit = _hit(1.0, court_x=3.0, court_y=6.0)
        assert determine_outcome_heuristic(hit, None, is_last_in_rally=True, homography=H) == Outcome.winner

    def test_last_shot_out_of_bounds_is_error(self):
        H = compute_homography(_cal())
        hit = _hit(1.0, court_x=10.0, court_y=20.0)
        assert determine_outcome_heuristic(hit, None, is_last_in_rally=True, homography=H) == Outcome.error

    def test_last_shot_no_homography_defaults_winner(self):
        hit = _hit(1.0, court_x=3.0, court_y=6.0)
        assert determine_outcome_heuristic(hit, None, is_last_in_rally=True, homography=None) == Outcome.winner


class TestHitToPlayer:
    def test_me(self):
        assert hit_to_player(_hit(0, side=Side.me)) == ShotPlayer.me

    def test_opponent(self):
        assert hit_to_player(_hit(0, side=Side.opponent)) == ShotPlayer.opponent

    def test_none_defaults_to_me(self):
        assert hit_to_player(_hit(0)) == ShotPlayer.me


class TestBuildShotResult:
    def test_produces_valid_result(self):
        H = compute_homography(_cal())
        hit = _hit(1.0, court_x=3.0, court_y=10.0, px_x=305, px_y=1000, side=Side.me)
        result = build_shot_result(hit, None, None, None, H, True, True, 0)
        assert result.shot_type == ShotType.serve
        assert isinstance(result.zone_from, Zone)
        assert isinstance(result.outcome, Outcome)
        assert result.timestamp == 1.0
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_shot_classification.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 6.1 | First shot = serve always | Returns `ShotType.serve` | Anything else |
| 6.2 | High speed + steep = smash | Returns `ShotType.smash` | Different type |
| 6.3 | Near net + short = net shot | Returns `ShotType.net` | Different type |
| 6.4 | Random inputs never crash | Always returns a valid `ShotType` | Exception |
| 6.5 | Non-last shot = neither | Returns `Outcome.neither` | Different outcome |
| 6.6 | Out-of-bounds = error | Returns `Outcome.error` | `winner` |
| 6.7 | `build_shot_result` returns complete object | All fields populated with valid enum values | `ValidationError` |

---

## 10. Layer 7: Pose estimation utilities (pure math)

**What it tests:** Keypoint extraction helpers and the arm-raised heuristic, using synthetic keypoint arrays.

**File:** `cv_service/tests/test_pose_utils.py`

**Tests to write:**

```python
# test_pose_utils.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import Keypoints
from stages.pose_estimation import (
    get_wrist_positions, get_shoulder_positions, detect_arm_raised,
    LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST,
)


def _make_keypoints(overrides=None):
    """Create 17 COCO keypoints (x, y, conf). All at (100, 200, 0.9) by default."""
    data = [100.0, 200.0, 0.9] * 17
    if overrides:
        for idx, (x, y, c) in overrides.items():
            base = idx * 3
            data[base] = x
            data[base + 1] = y
            data[base + 2] = c
    return Keypoints(data=data, track_id=1)


class TestGetWristPositions:
    def test_returns_positions(self):
        kp = _make_keypoints({LEFT_WRIST: (50, 60, 0.8), RIGHT_WRIST: (150, 60, 0.8)})
        left, right = get_wrist_positions(kp)
        assert left == (50, 60)
        assert right == (150, 60)

    def test_low_confidence_returns_none(self):
        kp = _make_keypoints({LEFT_WRIST: (50, 60, 0.1), RIGHT_WRIST: (150, 60, 0.1)})
        left, right = get_wrist_positions(kp)
        assert left is None
        assert right is None

    def test_too_short_data(self):
        kp = Keypoints(data=[0.0] * 9, track_id=1)
        left, right = get_wrist_positions(kp)
        assert left is None and right is None


class TestGetShoulderPositions:
    def test_returns_positions(self):
        kp = _make_keypoints({LEFT_SHOULDER: (80, 100, 0.9), RIGHT_SHOULDER: (120, 100, 0.9)})
        left, right = get_shoulder_positions(kp)
        assert left == (80, 100)
        assert right == (120, 100)


class TestDetectArmRaised:
    def test_arm_raised(self):
        """Wrist well above shoulder → arm raised."""
        kp = _make_keypoints({
            LEFT_SHOULDER: (100, 200, 0.9),
            LEFT_WRIST: (100, 100, 0.9),  # 100px above shoulder
            RIGHT_SHOULDER: (150, 200, 0.9),
            RIGHT_WRIST: (150, 300, 0.9),  # below shoulder
        })
        assert detect_arm_raised(kp) is True

    def test_arm_not_raised(self):
        """Wrists at or below shoulders → not raised."""
        kp = _make_keypoints({
            LEFT_SHOULDER: (100, 200, 0.9),
            LEFT_WRIST: (100, 220, 0.9),
            RIGHT_SHOULDER: (150, 200, 0.9),
            RIGHT_WRIST: (150, 250, 0.9),
        })
        assert detect_arm_raised(kp) is False

    def test_low_confidence_not_raised(self):
        """If keypoints have low confidence, should not detect arm raised."""
        kp = _make_keypoints({
            LEFT_SHOULDER: (100, 200, 0.1),
            LEFT_WRIST: (100, 50, 0.1),
        })
        assert detect_arm_raised(kp) is False
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_pose_utils.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 7.1 | Wrist extraction correct | Returns expected `(x, y)` tuples | Wrong values or crash |
| 7.2 | Low confidence → `None` | Returns `None` for both wrists | Returns positions |
| 7.3 | Arm raised detected when wrist above shoulder | Returns `True` | Returns `False` |
| 7.4 | Arm not raised when wrist below shoulder | Returns `False` | Returns `True` |

---

## 11. Layer 8: Model loading & inference smoke tests

**What it tests:** That pre-trained models load successfully and produce structurally valid output on a synthetic frame. This verifies the integration with Ultralytics is correct and models are downloadable.

**Requires:** Internet (first run, to auto-download YOLO models) + the test video from [Prerequisites 2.2](#22-test-video-file-for-layers-8).

**File:** `cv_service/tests/test_model_loading.py`

**Tests to write:**

```python
# test_model_loading.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest


def _synthetic_frame(h=480, w=640):
    """Create a synthetic BGR frame with simple shapes."""
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    import cv2
    # Draw a person-like rectangle
    cv2.rectangle(frame, (280, 100), (360, 400), (200, 200, 200), -1)
    # Head
    cv2.circle(frame, (320, 80), 30, (200, 200, 200), -1)
    return frame


class TestYoloDetectionModel:
    def test_loads_without_error(self):
        from stages.player_detection import _get_model
        model = _get_model()
        assert model is not None

    def test_inference_returns_results(self):
        from stages.player_detection import detect_players_in_frame, reset_tracker
        reset_tracker()
        frame = _synthetic_frame()
        players = detect_players_in_frame(frame, homography=None, persist=False)
        # We don't assert specific detections on a synthetic frame,
        # just that the function returns a valid list
        assert isinstance(players, list)

    def test_output_structure(self):
        from stages.player_detection import detect_players_in_frame, reset_tracker
        from models import PlayerBox
        reset_tracker()
        frame = _synthetic_frame()
        players = detect_players_in_frame(frame, homography=None, persist=False)
        for p in players:
            assert isinstance(p, PlayerBox)
            assert len(p.bbox) == 4
            assert p.center.x >= 0
            assert p.center.y >= 0


class TestYoloPoseModel:
    def test_loads_without_error(self):
        from stages.pose_estimation import _get_model
        model = _get_model()
        assert model is not None

    def test_inference_returns_keypoints(self):
        from stages.pose_estimation import estimate_poses
        from models import Keypoints
        frame = _synthetic_frame()
        kps = estimate_poses(frame)
        assert isinstance(kps, list)
        for kp in kps:
            assert isinstance(kp, Keypoints)
            assert len(kp.data) == 51  # 17 keypoints * 3 values


class TestTrackNetAvailability:
    def test_is_available_returns_bool(self):
        from stages.shuttle_tracking import is_available
        result = is_available()
        assert isinstance(result, bool)

    @pytest.mark.skipif(
        not __import__("stages.shuttle_tracking", fromlist=["is_available"]).is_available(),
        reason="TrackNetV3 not installed",
    )
    def test_shuttle_detection_runs(self):
        from stages.shuttle_tracking import detect_shuttle
        frames = [_synthetic_frame() for _ in range(3)]
        results = detect_shuttle(frames)
        assert isinstance(results, list)
        assert len(results) == 3


class TestSceneDetectImport:
    def test_scenedetect_imports(self):
        from scenedetect import detect, ContentDetector
        assert detect is not None
        assert ContentDetector is not None
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_model_loading.py -v --timeout=120
```

> The `--timeout` flag accounts for first-run model downloads. Install `pytest-timeout` if needed: `pip install pytest-timeout`.

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 8.1 | YOLO detection model loads | `_get_model()` returns non-None | Import or load error |
| 8.2 | YOLO detection runs on synthetic frame | Returns `list[PlayerBox]` (may be empty) | Exception |
| 8.3 | YOLO pose model loads | `_get_model()` returns non-None | Import or load error |
| 8.4 | Pose estimation runs on synthetic frame | Returns `list[Keypoints]` (may be empty) | Exception |
| 8.5 | TrackNetV3 availability check returns bool | `True` or `False` | Exception |
| 8.6 | TrackNetV3 runs if available | Returns list of 3 entries | Exception (skip if unavailable) |
| 8.7 | PySceneDetect imports | No error | `ModuleNotFoundError` |

---

## 12. Layer 9: Scene cut detection

**What it tests:** PySceneDetect integration — processing a video file and returning segment data.

**Requires:** Test video file.

**File:** `cv_service/tests/test_scene_cut.py`

**Tests to write:**

```python
# test_scene_cut.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from pathlib import Path
from stages.scene_cut import detect_scene_cuts, merge_gameplay_segments, VideoSegment

FIXTURES = Path(__file__).parent / "fixtures"
TEST_VIDEO = FIXTURES / "test_video.mp4"


@pytest.mark.skipif(not TEST_VIDEO.exists(), reason="Test video not found")
class TestSceneCutDetection:
    def test_returns_segments(self):
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        assert isinstance(segments, list)
        assert len(segments) >= 1

    def test_segment_structure(self):
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        for seg in segments:
            assert isinstance(seg, VideoSegment)
            assert seg.start_frame >= 0
            assert seg.end_frame >= seg.start_frame
            assert seg.start_sec >= 0
            assert seg.end_sec >= seg.start_sec

    def test_covers_full_video(self):
        """Segments should collectively cover the video timeline."""
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        assert segments[0].start_frame == 0
        assert segments[-1].end_frame >= 100

    def test_synthetic_no_cuts(self):
        """A uniform synthetic video should produce a single segment."""
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        gameplay = [s for s in segments if s.is_gameplay]
        assert len(gameplay) >= 1


class TestMergeGameplay:
    def test_merges_close_segments(self):
        segs = [
            VideoSegment(0, 100, 0.0, 3.33, True),
            VideoSegment(101, 105, 3.37, 3.5, False),
            VideoSegment(106, 200, 3.53, 6.67, True),
        ]
        merged = merge_gameplay_segments(segs, gap_threshold_sec=1.0)
        assert len(merged) == 1
        assert merged[0].start_frame == 0
        assert merged[0].end_frame == 200

    def test_keeps_distant_segments_separate(self):
        segs = [
            VideoSegment(0, 100, 0.0, 3.33, True),
            VideoSegment(300, 400, 10.0, 13.33, True),
        ]
        merged = merge_gameplay_segments(segs, gap_threshold_sec=1.0)
        assert len(merged) == 2

    def test_empty_input(self):
        assert merge_gameplay_segments([]) == []

    def test_non_gameplay_filtered(self):
        segs = [
            VideoSegment(0, 100, 0.0, 3.33, True),
            VideoSegment(101, 200, 3.37, 6.67, False),
            VideoSegment(201, 300, 6.7, 10.0, True),
        ]
        merged = merge_gameplay_segments(segs, gap_threshold_sec=1.0)
        for seg in merged:
            assert seg.is_gameplay
```

**How to run:**

```bash
cd cv_service
python -m pytest tests/test_scene_cut.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 9.1 | Returns non-empty segment list from video | At least 1 `VideoSegment` | Empty or exception |
| 9.2 | Segments have valid structure | All fields non-negative, start <= end | Invalid values |
| 9.3 | Merge combines close gameplay segments | 2 close segments → 1 merged | Still separate |
| 9.4 | Merge keeps distant segments apart | 2 distant segments → 2 | Incorrectly merged |
| 9.5 | Non-gameplay segments filtered out | Only `is_gameplay=True` in output | Non-gameplay present |

---

## 13. Layer 10: FastAPI service integration

**What it tests:** The HTTP API contract — endpoints accept correct payloads, return correct status codes, and the job lifecycle works.

**Requires:** All Python dependencies installed. Uses `httpx.AsyncClient` with FastAPI's `TestClient` — no need to start the server.

**File:** `cv_service/tests/test_api.py`

**Tests to write:**

```python
# test_api.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from config import settings
from main import app


@pytest.fixture(autouse=True)
def tmp_jobs_dir():
    """Redirect job storage to temp directory."""
    orig = settings.jobs_dir
    with tempfile.TemporaryDirectory() as d:
        settings.jobs_dir = Path(d)
        yield
        settings.jobs_dir = orig


class TestHealthEndpoint:
    def test_returns_ok(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "shuttle_tracking" in data
        assert isinstance(data["shuttle_tracking"], bool)


class TestAnalyzeEndpoint:
    def test_returns_job_id(self):
        client = TestClient(app)
        # Patch run_pipeline to avoid actually processing
        with patch("main.run_pipeline") as mock_pipeline:
            mock_pipeline.return_value = MagicMock(rally_count=0, shot_count=0)
            resp = client.post("/analyze", json={
                "video_path": "/fake/path.mp4",
                "match_id": 1,
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "job_id" in data
        assert data["status"] in ("queued", "running")

    def test_validation_error(self):
        client = TestClient(app)
        resp = client.post("/analyze", json={"bad": "data"})
        assert resp.status_code == 422  # Pydantic validation

    def test_with_calibration(self):
        client = TestClient(app)
        with patch("main.run_pipeline") as mock_pipeline:
            mock_pipeline.return_value = MagicMock(rally_count=0, shot_count=0)
            resp = client.post("/analyze", json={
                "video_path": "/fake/path.mp4",
                "match_id": 1,
                "calibration": {
                    "top_left": {"x": 0, "y": 0},
                    "top_right": {"x": 100, "y": 0},
                    "bottom_right": {"x": 100, "y": 200},
                    "bottom_left": {"x": 0, "y": 200},
                    "near_side": "me",
                },
            })
        assert resp.status_code == 200


class TestJobsEndpoint:
    def test_nonexistent_job_404(self):
        client = TestClient(app)
        resp = client.get("/jobs/nonexistent")
        assert resp.status_code == 404

    def test_created_job_retrievable(self):
        client = TestClient(app)
        with patch("main.run_pipeline") as mock_pipeline:
            mock_pipeline.return_value = MagicMock(rally_count=0, shot_count=0)
            create_resp = client.post("/analyze", json={
                "video_path": "/fake/path.mp4",
                "match_id": 1,
            })
        job_id = create_resp.json()["job_id"]

        resp = client.get(f"/jobs/{job_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == job_id
        assert data["status"] in ("queued", "running", "completed")
```

**How to run:**

```bash
cd cv_service
pip install httpx  # needed for TestClient
python -m pytest tests/test_api.py -v
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 10.1 | `/health` returns 200 with expected shape | Status "ok" + `shuttle_tracking` bool | Wrong status code or missing fields |
| 10.2 | `POST /analyze` returns job_id | 200 with `job_id` string | Error status or missing field |
| 10.3 | Invalid payload → 422 | Pydantic validation error | 200 or 500 |
| 10.4 | Calibration data accepted | 200 | Validation error |
| 10.5 | `GET /jobs/{id}` for missing job → 404 | 404 | 200 or 500 |
| 10.6 | Created job is retrievable | 200 with matching `job_id` | 404 |

---

## 14. Layer 11: Next.js API route integration

**What it tests:** The TypeScript proxy layer that connects the frontend to the Python service. Run via the existing Vitest setup.

**Approach:** These are harder to unit test in isolation since they depend on both the Python service and the database. The recommended approach is **manual integration testing** combined with a lightweight contract test.

### 14.1 Manual integration test

**Prerequisites:** Both services running (`python main.py` + `npm run dev`), a match with a local video in the database.

**Steps:**

```bash
# 1. Verify Python service is reachable from Next.js
curl http://127.0.0.1:8100/health
# Expected: {"status":"ok","shuttle_tracking":...}

# 2. Start a CV analysis job via the Next.js route
curl -X POST http://localhost:3000/api/matches/1/cv-analyze \
  -H "Content-Type: application/json" \
  -d '{"calibration": null}'
# Expected: {"job_id":"...","status":"queued"} or error if match 1 not local

# 3. Poll job status
curl "http://localhost:3000/api/matches/1/cv-analyze?jobId=<JOB_ID>"
# Expected: {"job_id":"...","status":"running","progress":"...","progress_pct":0.15}
```

### 14.2 Enum consistency test (automated)

This verifies the Python and TypeScript enum values stay in sync. Add to the TypeScript test suite.

**File:** `src/lib/cv_enum_sync.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  shotTypeEnum,
  zoneEnum,
  outcomeEnum,
  shotPlayerEnum,
  sideEnum,
} from "@/db/schema";

// These must match the Python models.py enums exactly
const PYTHON_SHOT_TYPES = ["serve", "clear", "smash", "drop", "drive", "lift", "net", "block"];
const PYTHON_ZONES = [
  "left_front", "left_mid", "left_back",
  "center_front", "center_mid", "center_back",
  "right_front", "right_mid", "right_back",
];
const PYTHON_OUTCOMES = ["winner", "error", "neither"];
const PYTHON_SHOT_PLAYERS = ["me", "partner", "opponent"];
const PYTHON_SIDES = ["me", "opponent"];

describe("CV enum sync with Python models", () => {
  it("shot types match", () => {
    expect([...shotTypeEnum].sort()).toEqual([...PYTHON_SHOT_TYPES].sort());
  });
  it("zones match", () => {
    expect([...zoneEnum].sort()).toEqual([...PYTHON_ZONES].sort());
  });
  it("outcomes match", () => {
    expect([...outcomeEnum].sort()).toEqual([...PYTHON_OUTCOMES].sort());
  });
  it("shot players match", () => {
    expect([...shotPlayerEnum].sort()).toEqual([...PYTHON_SHOT_PLAYERS].sort());
  });
  it("sides match", () => {
    expect([...sideEnum].sort()).toEqual([...PYTHON_SIDES].sort());
  });
});
```

**How to run:**

```bash
npm run test
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 11.1 | `/health` reachable from same machine | Returns JSON with `status: "ok"` | Connection refused |
| 11.2 | `POST /cv-analyze` returns job_id | 200 with `job_id` | 502/503 |
| 11.3 | `GET /cv-analyze?jobId=` returns progress | 200 with valid `status` field | 404/500 |
| 11.4 | Python/TS enums identical | All 5 enum sets match | Any mismatch (data corruption risk) |

---

## 15. Layer 12: End-to-end pipeline

**What it tests:** The full analysis pipeline from video to structured output. This is the final integration test.

**Requires:** Both services running, a match with a local video, Python CV service started.

### 12.1 Via the UI (manual)

1. Open `http://localhost:3000`
2. Navigate to a match with a local video
3. Click **Calibrate Court** → mark 4 corners → **Confirm**
4. Click **CV Analysis**
5. Observe progress bar advancing through stages
6. Wait for completion message

### 12.2 Via curl (scripted)

```bash
# Replace MATCH_ID with your test match ID
MATCH_ID=1

# Start analysis
JOB=$(curl -s -X POST "http://localhost:3000/api/matches/${MATCH_ID}/cv-analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "calibration": {
      "top_left": {"x": 100, "y": 50},
      "top_right": {"x": 540, "y": 50},
      "bottom_right": {"x": 540, "y": 430},
      "bottom_left": {"x": 100, "y": 430},
      "near_side": "me"
    }
  }')

JOB_ID=$(echo $JOB | python -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
echo "Job ID: $JOB_ID"

# Poll until complete (timeout after 5 minutes)
for i in $(seq 1 100); do
  sleep 3
  STATUS=$(curl -s "http://localhost:3000/api/matches/${MATCH_ID}/cv-analyze?jobId=${JOB_ID}")
  echo "$STATUS" | python -c "
import sys, json
d = json.load(sys.stdin)
print(f\"Status: {d['status']}  Progress: {d.get('progress', '-')}  Pct: {d.get('progress_pct', '-')}\")
"
  echo "$STATUS" | python -c "
import sys, json
d = json.load(sys.stdin)
if d['status'] in ('completed', 'failed'):
    if d['status'] == 'completed':
        r = d.get('result', {})
        print(f'COMPLETE: {r.get(\"rally_count\", 0)} rallies, {r.get(\"shot_count\", 0)} shots')
    else:
        print(f'FAILED: {d.get(\"error\", \"unknown\")}')
    sys.exit(0)
" && break
done
```

### 12.3 Programmatic Python test (no Next.js needed)

```python
# Run from cv_service/ directory
# python -c "<paste this>"
from models import AnalyzeRequest, CourtCalibration, Point2D, Side
from pipeline import run_pipeline

request = AnalyzeRequest(
    video_path="tests/fixtures/test_video.mp4",
    match_id=999,
    calibration=CourtCalibration(
        top_left=Point2D(x=100, y=50),
        top_right=Point2D(x=540, y=50),
        bottom_right=Point2D(x=540, y=430),
        bottom_left=Point2D(x=100, y=430),
        near_side=Side.me,
    ),
)

def progress(msg, pct):
    print(f"  [{pct:.0%}] {msg}")

result = run_pipeline(request, on_progress=progress)
print(f"\nResult: {result.rally_count} rallies, {result.shot_count} shots")
for i, rally in enumerate(result.rallies):
    print(f"  Rally {i+1}: {len(rally.shots)} shots, won_by_me={rally.won_by_me}")
    for j, shot in enumerate(rally.shots):
        print(f"    Shot {j+1}: {shot.shot_type.value} by {shot.player.value} "
              f"({shot.zone_from.value} → {shot.zone_to.value}) [{shot.outcome.value}]")
```

### Accept / Fail criteria

| # | Criterion | Pass | Fail |
|---|-----------|------|------|
| 12.1 | Pipeline completes without exception | Returns `AnalysisOutput` | Unhandled exception |
| 12.2 | Progress callback fires | At least 5 progress messages printed | No progress updates |
| 12.3 | Output structure valid | All shots have valid enum values for `shot_type`, `zone_from`, `zone_to`, `outcome`, `player` | Invalid enum or missing field |
| 12.4 | First shot of each rally is `serve` | Every `rally.shots[0].shot_type == "serve"` | Non-serve first shot |
| 12.5 | Timestamps are monotonically increasing within a rally | `shots[i].timestamp <= shots[i+1].timestamp` | Out of order |
| 12.6 | On synthetic video with no real players | Returns 0 rallies, 0 shots (empty result is valid) | Crashes |
| 12.7 | DB write succeeds (via Next.js) | Rallies/shots appear in match detail page | DB error or missing data |

---

## 16. Test summary matrix

| Layer | Component | Test type | Needs models? | Needs video? | Needs GPU? | Estimated time |
|-------|-----------|-----------|--------------|-------------|-----------|---------------|
| 0 | Environment & imports | Smoke | No | No | No | 5s |
| 1 | Pydantic models & enums | Unit | No | No | No | 1s |
| 2 | Job store | Unit | No | No | No | 1s |
| 3 | Court detection & homography | Unit | No | No | No | 1s |
| 4 | Hit detection | Unit | No | No | No | 1s |
| 5 | Rally segmentation | Unit | No | No | No | 1s |
| 6 | Shot classification | Unit | No | No | No | 1s |
| 7 | Pose utilities | Unit | No | No | No | 1s |
| 8 | Model loading & inference | Smoke | Yes (auto-download) | No | Preferred | 30-60s |
| 9 | Scene cut detection | Integration | No | Yes | No | 5s |
| 10 | FastAPI endpoints | Integration | Mocked | No | No | 2s |
| 11 | Next.js proxy + enum sync | Integration / Unit | Partial | No | No | 5s |
| 12 | Full pipeline E2E | E2E | Yes | Yes | Preferred | 1-10 min |

### Recommended test execution order

Run tests in ascending layer order. If a lower layer fails, fix it before proceeding — higher layers depend on it.

```bash
# ── Python tests (from cv_service/ with venv activated) ──

# Layers 0-7: pure logic, no dependencies on models/video (< 10 seconds total)
python -m pytest tests/test_models.py tests/test_job_store.py \
  tests/test_court_detection.py tests/test_hit_detection.py \
  tests/test_rally_segmentation.py tests/test_shot_classification.py \
  tests/test_pose_utils.py -v

# Layer 8: model loading (needs internet for first download)
python -m pytest tests/test_model_loading.py -v --timeout=120

# Layer 9: scene cut (needs test video)
python -m pytest tests/test_scene_cut.py -v

# Layer 10: FastAPI endpoints (mocked pipeline)
python -m pytest tests/test_api.py -v

# ── TypeScript tests (from project root) ──

# Layer 11: enum sync
npm run test

# ── Manual / E2E ──

# Layer 12: full pipeline (start both services first)
cd cv_service && python -c "..."  # see Layer 12 script above
```
