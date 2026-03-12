"""Diagnostic script: runs the pipeline stage by stage and reports where it breaks.

Usage (from cv_service/ with venv activated):
    python diagnose.py "C:/path/to/your/video.mp4"

Optionally supply calibration corners (pixel coords):
    python diagnose.py "C:/path/to/video.mp4" --corners 120,45 530,48 560,420 95,418
"""

from __future__ import annotations

import argparse
import logging
import sys
import time

import cv2
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("diagnose")

# Make project modules importable
sys.path.insert(0, ".")

from config import settings
from models import (
    CourtCalibration,
    Point2D,
    Side,
    FrameData,
    ShuttlePosition,
)


def section(title: str):
    log.info("")
    log.info("=" * 70)
    log.info("  %s", title)
    log.info("=" * 70)


def ok(msg: str):
    log.info("  [OK]   %s", msg)


def warn(msg: str):
    log.info("  [WARN] %s", msg)


def fail(msg: str):
    log.info("  [FAIL] %s", msg)


def info(msg: str):
    log.info("         %s", msg)


def parse_args():
    parser = argparse.ArgumentParser(description="Diagnose CV pipeline failures")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument(
        "--corners",
        nargs=4,
        metavar=("TL", "TR", "BR", "BL"),
        help="Court corners as x,y pairs (e.g. 120,45 530,48 560,420 95,418)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=300,
        help="Max frames to process for diagnosis (default 300 = ~10s at 30fps)",
    )
    return parser.parse_args()


def parse_point(s: str) -> Point2D:
    x, y = s.split(",")
    return Point2D(x=float(x), y=float(y))


def main():
    args = parse_args()

    # ── Video check ──────────────────────────────────────────────────────
    section("STAGE 0: Video file")
    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        fail(f"Cannot open video: {args.video}")
        return
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0
    ok(f"Opened: {width}x{height}, {fps:.1f} FPS, {total_frames} frames, {duration:.1f}s")

    ret, sample_frame = cap.read()
    if not ret:
        fail("Cannot read first frame")
        return
    ok(f"First frame readable, shape: {sample_frame.shape}")

    # ── Stage 1: Scene cuts ──────────────────────────────────────────────
    section("STAGE 1: Scene cut detection")
    from stages.scene_cut import detect_scene_cuts, merge_gameplay_segments

    segments = detect_scene_cuts(args.video, fps, total_frames)
    gameplay_segments = merge_gameplay_segments(segments)
    total_gameplay_frames = sum(s.end_frame - s.start_frame for s in gameplay_segments)

    info(f"Raw segments from PySceneDetect: {len(segments)}")
    for s in segments:
        tag = "gameplay" if s.is_gameplay else "NON-gameplay"
        info(f"  {s.start_sec:.1f}s – {s.end_sec:.1f}s  ({tag})")

    info(f"After merging: {len(gameplay_segments)} gameplay segment(s)")
    info(f"Total gameplay frames: {total_gameplay_frames}")

    if len(gameplay_segments) == 0:
        fail("No gameplay segments! The pipeline will process 0 frames.")
        fail("Fix: all footage was classified as non-gameplay (< 3s segments).")
        fail("Try lowering CV_SCENE_CUT_THRESHOLD (current: {settings.scene_cut_threshold}).")
        return
    else:
        ok(f"{len(gameplay_segments)} gameplay segment(s) covering {total_gameplay_frames} frames")

    # ── Stage 2: Court homography ────────────────────────────────────────
    section("STAGE 2: Court calibration & homography")
    from stages.court_detection import compute_homography, Homography

    homography: Homography | None = None
    if args.corners:
        cal = CourtCalibration(
            top_left=parse_point(args.corners[0]),
            top_right=parse_point(args.corners[1]),
            bottom_right=parse_point(args.corners[2]),
            bottom_left=parse_point(args.corners[3]),
            near_side=Side.me,
        )
        try:
            homography = compute_homography(cal)
            ok(f"Homography computed. Matrix shape: {homography.matrix.shape}")

            # Sanity: project frame center to court coords
            cx, cy = homography.pixel_to_court(width / 2, height / 2)
            info(f"Frame center ({width/2:.0f}, {height/2:.0f}) → court ({cx:.1f}, {cy:.1f})m")
            if 0 <= cx <= 6.1 and 0 <= cy <= 13.4:
                ok("Frame center maps inside court bounds")
            else:
                warn("Frame center maps OUTSIDE court bounds — calibration may be off")
        except Exception as e:
            fail(f"Homography computation failed: {e}")
    else:
        warn("No --corners provided. Zone mapping will use defaults.")
        warn("Player court filtering will be DISABLED (all detected persons kept).")
        info("To provide: --corners TL_x,TL_y TR_x,TR_y BR_x,BR_y BL_x,BL_y")

    # ── Stage 3: Player detection ────────────────────────────────────────
    section("STAGE 3: Player detection (sampling frames)")
    from stages.player_detection import detect_players_in_frame, filter_court_players, reset_tracker

    reset_tracker()
    seg = gameplay_segments[0]
    cap.set(cv2.CAP_PROP_POS_FRAMES, seg.start_frame)

    n_sample = min(10, args.max_frames)
    step = max(1, (seg.end_frame - seg.start_frame) // n_sample)
    total_raw_detections = 0
    total_court_players = 0
    frames_with_players = 0

    for i in range(n_sample):
        frame_idx = seg.start_frame + i * step
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break
        players = detect_players_in_frame(frame, homography, persist=False)
        court_players = filter_court_players(players)
        total_raw_detections += len(players)
        total_court_players += len(court_players)
        if court_players:
            frames_with_players += 1
        info(f"  Frame {frame_idx}: {len(players)} detected, {len(court_players)} on court")
        reset_tracker()

    if total_raw_detections == 0:
        fail("YOLO detected 0 persons in all sampled frames!")
        fail("Check: is the video too dark? Are players visible?")
    else:
        ok(f"Raw detections: {total_raw_detections} across {n_sample} frames")

    if homography and total_court_players == 0 and total_raw_detections > 0:
        fail("Players detected but ALL filtered out by court bounds!")
        fail("This means detected players' feet map outside court coordinates.")
        fail("Your calibration corners are likely wrong.")
        info("The homography maps foot positions to court coords and keeps only")
        info("those within 0–6.1m (width) and 0–13.4m (length).")
        info("Try re-calibrating with more accurate corner clicks.")
    elif total_court_players > 0:
        ok(f"Court players: {total_court_players} across {n_sample} frames")
    elif not homography:
        warn("No homography → no court filtering → all detections kept")
        warn("Hits won't have court positions for zone mapping.")

    # ── Stage 4: Shuttle tracking ────────────────────────────────────────
    section("STAGE 4: Shuttle tracking (TrackNetV3)")
    from stages.shuttle_tracking import is_available as shuttle_available

    use_shuttle = shuttle_available()
    if use_shuttle:
        ok("TrackNetV3 IS available")
        from stages.shuttle_tracking import detect_shuttle

        cap.set(cv2.CAP_PROP_POS_FRAMES, seg.start_frame)
        frame_buffer = []
        shuttle_count = 0
        frames_checked = 0
        for i in range(min(args.max_frames, seg.end_frame - seg.start_frame)):
            ret, frame = cap.read()
            if not ret:
                break
            frame_buffer.append(frame)
            if len(frame_buffer) > 10:
                frame_buffer.pop(0)
            if len(frame_buffer) >= 3:
                results = detect_shuttle(frame_buffer[-3:], homography)
                if results[-1] is not None:
                    shuttle_count += 1
                frames_checked += 1

        info(f"Shuttle detected in {shuttle_count}/{frames_checked} frames ({shuttle_count/max(frames_checked,1)*100:.0f}%)")
        if shuttle_count == 0:
            fail("TrackNet found 0 shuttle positions!")
            fail(f"shuttle_conf_threshold is {settings.shuttle_conf_threshold}")
            fail("Try lowering it: set CV_SHUTTLE_CONF_THRESHOLD=0.3")
            fail("Or the TrackNet weights may not match your video type.")
        elif shuttle_count < frames_checked * 0.05:
            warn(f"Very low shuttle detection rate ({shuttle_count/frames_checked*100:.1f}%)")
            warn("Hit detection will have very few trajectory points.")
        else:
            ok(f"Shuttle detection looks healthy ({shuttle_count/frames_checked*100:.1f}%)")
    else:
        warn("TrackNetV3 is NOT available — will use pose-based fallback")
        info(f"Weights expected at: {settings.weights_dir / settings.tracknet_weights}")
        info(f"Vendor repo expected at: {settings.vendor_dir / 'TrackNetV3'}")

    # ── Stage 5: Pose estimation + arm-raise detection ───────────────────
    section("STAGE 5: Pose estimation & arm-raise detection")
    from stages.pose_estimation import estimate_poses, detect_arm_raised

    reset_tracker()
    cap.set(cv2.CAP_PROP_POS_FRAMES, seg.start_frame)

    pose_frames = 0
    total_kps = 0
    arm_raises = 0
    arm_raise_frames = []

    for i in range(min(args.max_frames, seg.end_frame - seg.start_frame)):
        ret, frame = cap.read()
        if not ret:
            break
        kps = estimate_poses(frame)
        total_kps += len(kps)
        pose_frames += 1
        for kp in kps:
            if detect_arm_raised(kp):
                arm_raises += 1
                arm_raise_frames.append(seg.start_frame + i)
                break

    info(f"Processed {pose_frames} frames, {total_kps} pose detections")
    info(f"Arm-raise events: {arm_raises}")

    if total_kps == 0:
        fail("Pose model detected 0 keypoints in all frames!")
    else:
        ok(f"Pose detection working: {total_kps} keypoints across {pose_frames} frames")

    if not use_shuttle:
        info("")
        info("** Since TrackNet is unavailable, hit detection uses arm-raise fallback **")
        if arm_raises == 0:
            fail("0 arm-raise events detected → 0 hits → 0 rallies!")
            fail("This is very likely the cause of your empty results.")
            info("")
            info("Possible fixes:")
            info("  1. BEST: Install TrackNetV3 for shuttle-based hit detection")
            info("     - Clone repo to cv_service/vendor/TrackNetV3")
            info("     - Download weights to cv_service/weights/tracknetv3.pt")
            info("")
            info("  2. Lower the arm-raise sensitivity threshold:")
            info("     In stages/pose_estimation.py, detect_arm_raised():")
            info(f"     Current: shoulder_to_hip_approx = 50, threshold_ratio = 0.8")
            info(f"     → Requires wrist to be {int(50 * 0.8)}px above shoulder")
            info("     For far-away players, this threshold may be too high.")
            info("     Try: shoulder_to_hip_approx = 30, threshold_ratio = 0.5")
        elif arm_raises < 5:
            warn(f"Only {arm_raises} arm-raise events — might be too few for meaningful rallies")
        else:
            ok(f"{arm_raises} arm-raise events — should produce hits")

    # ── Hit detection simulation ─────────────────────────────────────────
    section("HIT DETECTION (full run on first segment)")
    from stages.hit_detection import detect_hits_from_trajectory, detect_hits_from_poses

    reset_tracker()
    cap.set(cv2.CAP_PROP_POS_FRAMES, seg.start_frame)
    frame_buffer = []
    all_frame_data: list[FrameData] = []

    max_frames = min(args.max_frames, seg.end_frame - seg.start_frame)
    info(f"Processing {max_frames} frames for hit detection...")
    t0 = time.time()

    for i in range(max_frames):
        frame_idx = seg.start_frame + i
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps
        players = detect_players_in_frame(frame, homography)
        court_players = filter_court_players(players)

        shuttle: ShuttlePosition | None = None
        if use_shuttle:
            frame_buffer.append(frame)
            if len(frame_buffer) > 10:
                frame_buffer.pop(0)
            if len(frame_buffer) >= 3:
                shuttle_results = detect_shuttle(frame_buffer[-3:], homography)
                shuttle = shuttle_results[-1] if shuttle_results else None

        keypoints = estimate_poses(frame, court_players if court_players else None)

        fd = FrameData(
            frame_idx=frame_idx,
            timestamp=timestamp,
            players=court_players,
            shuttle=shuttle,
            keypoints=keypoints,
        )
        all_frame_data.append(fd)

    elapsed = time.time() - t0
    info(f"Processed {len(all_frame_data)} frames in {elapsed:.1f}s ({len(all_frame_data)/max(elapsed,0.01):.0f} fps)")

    shuttle_frames = sum(1 for fd in all_frame_data if fd.shuttle is not None)
    player_frames = sum(1 for fd in all_frame_data if fd.players)
    info(f"Frames with shuttle: {shuttle_frames}/{len(all_frame_data)}")
    info(f"Frames with players: {player_frames}/{len(all_frame_data)}")

    if use_shuttle:
        hits = detect_hits_from_trajectory(all_frame_data)
        info(f"Trajectory-based hits: {len(hits)}")
    else:
        hits = detect_hits_from_poses(all_frame_data)
        info(f"Pose-based hits: {len(hits)}")

    if not hits:
        fail("0 hits detected! This is why you get 0 rallies / 0 shots.")
    else:
        ok(f"{len(hits)} hits detected")
        for h in hits[:10]:
            info(f"  Hit at {h.timestamp:.2f}s (frame {h.frame_idx}), player={h.player_side}")

    # ── Rally segmentation ───────────────────────────────────────────────
    if hits:
        section("RALLY SEGMENTATION")
        from stages.rally_segmentation import segment_rallies

        frame_data_map = {fd.frame_idx: fd for fd in all_frame_data}
        rally_groups = segment_rallies(hits, frame_data_map, homography)
        info(f"Rally groups (before filtering): see raw hit grouping")

        # Show the raw grouping before the >=2 filter
        raw_groups: list[list] = [[hits[0]]]
        for i in range(1, len(hits)):
            gap = hits[i].timestamp - hits[i - 1].timestamp
            if gap > settings.rally_gap_seconds:
                raw_groups.append([hits[i]])
            else:
                raw_groups[-1].append(hits[i])

        info(f"Raw groups (before min-2 filter): {len(raw_groups)}")
        for i, g in enumerate(raw_groups):
            status = "KEPT" if len(g) >= 2 else "FILTERED (< 2 hits)"
            info(f"  Group {i+1}: {len(g)} hits, span {g[0].timestamp:.1f}s–{g[-1].timestamp:.1f}s → {status}")

        info(f"Final rallies (after >=2 filter): {len(rally_groups)}")

        if len(rally_groups) == 0 and len(raw_groups) > 0:
            fail("Hits were found but ALL rally groups had <2 hits!")
            fail("Every detected hit is isolated (>3s from any other hit).")
            info("Fixes:")
            info(f"  - Increase rally_gap_seconds (current: {settings.rally_gap_seconds})")
            info("  - Improve hit detection to find more hits per rally")

    # ── Summary ──────────────────────────────────────────────────────────
    section("DIAGNOSIS SUMMARY")
    problems = []
    if len(gameplay_segments) == 0:
        problems.append("No gameplay segments detected")
    if total_raw_detections == 0:
        problems.append("YOLO detected no persons")
    if homography and total_court_players == 0 and total_raw_detections > 0:
        problems.append("All players filtered out by court bounds (bad calibration?)")
    if use_shuttle and shuttle_count == 0:
        problems.append("TrackNet found 0 shuttle positions")
    if not use_shuttle and arm_raises == 0:
        problems.append("Pose fallback: 0 arm-raise events detected")
    if not hits:
        problems.append("0 hits detected")

    if not problems:
        ok("No obvious issues found in the diagnostic frames!")
        info("If full pipeline still returns 0, try increasing --max-frames")
    else:
        fail(f"Found {len(problems)} issue(s):")
        for p in problems:
            fail(f"  → {p}")

    info("")
    info("Pipeline chain: video → scene cuts → players → shuttle/pose → hits → rallies")
    info("The FIRST failure in this chain causes 0 output.")

    cap.release()


if __name__ == "__main__":
    main()
