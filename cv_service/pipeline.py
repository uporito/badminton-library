"""Pipeline orchestrator: runs all CV stages on a video and produces structured output."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

from config import settings
from models import (
    AnalyzeRequest,
    AnalysisOutput,
    CourtCalibration,
    FrameData,
    ShuttlePosition,
)
from stages.scene_cut import detect_scene_cuts, merge_gameplay_segments
from stages.court_detection import compute_homography, Homography
from stages.player_detection import (
    detect_players_in_frame,
    filter_court_players,
    reset_tracker,
)
from stages.shuttle_tracking import detect_shuttle, is_available as shuttle_available
from stages.pose_estimation import estimate_poses
from stages.hit_detection import detect_hits_from_trajectory, detect_hits_from_poses
from stages.rally_segmentation import segment_rallies, build_rally_results
from video_download import download_video

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, float], None]

# Fraction of progress bar reserved for the download phase when using a URL source.
_DOWNLOAD_PCT_END = 0.10


def _noop_progress(msg: str, pct: float) -> None:
    pass


def _scale_pct(pct: float, start: float, end: float) -> float:
    """Re-map a [0, 1] fraction into [start, end]."""
    return start + pct * (end - start)


def run_pipeline(
    request: AnalyzeRequest,
    on_progress: ProgressCallback | None = None,
) -> AnalysisOutput:
    """Run the full CV analysis pipeline on a video.

    Stages:
      0. (optional) Download remote video to a temp file
      1. Scene cut detection (filter non-gameplay)
      2. Court detection (homography from calibration)
      3. Per-frame: player detection, shuttle tracking, pose estimation
      4. Hit frame detection
      5. Rally segmentation + shot classification
    """
    progress = on_progress or _noop_progress

    # ── Stage 0: Download remote video if needed ─────────────────────────
    temp_video_path: str | None = None
    if request.video_url:
        def _dl_progress(msg: str, pct: float) -> None:
            progress(msg, _scale_pct(pct, 0.0, _DOWNLOAD_PCT_END))

        temp_video_path = download_video(
            request.video_url,
            request.auth_header,
            on_progress=_dl_progress,
            start_pct=0.0,
            end_pct=1.0,
        )
        video_path = temp_video_path
    else:
        video_path = request.video_path  # type: ignore[assignment]

    try:
        return _run_pipeline_on_file(request, video_path, progress)
    finally:
        if temp_video_path and Path(temp_video_path).exists():
            try:
                os.unlink(temp_video_path)
                logger.info("Deleted temp video file: %s", temp_video_path)
            except OSError as e:
                logger.warning("Could not delete temp video file %s: %s", temp_video_path, e)


def _run_pipeline_on_file(
    request: AnalyzeRequest,
    video_path: str,
    progress: ProgressCallback,
) -> AnalysisOutput:
    """Run pipeline stages 1-5 on a resolved local file path."""
    # Pipeline progress occupies [_DOWNLOAD_PCT_END, 1.0] when a download
    # occurred, or [0.0, 1.0] for local files.  We always pass raw fractions
    # to the helper and let _p() remap them.
    has_download = bool(request.video_url)
    p_start = _DOWNLOAD_PCT_END if has_download else 0.0

    def _p(raw_pct: float) -> float:
        return _scale_pct(raw_pct, p_start, 1.0)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = request.fps_override or cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    progress(f"Video loaded: {total_frames} frames, {fps:.1f} FPS, {duration:.0f}s", _p(0.0))

    # ── Stage 1: Scene cuts ──────────────────────────────────────────────
    progress("Stage 1/5: Detecting scene cuts...", _p(0.05))
    segments = detect_scene_cuts(video_path, fps, total_frames)
    gameplay_segments = merge_gameplay_segments(segments)
    progress(
        f"Found {len(gameplay_segments)} gameplay segment(s) "
        f"out of {len(segments)} total",
        _p(0.10),
    )

    # ── Stage 2: Court detection ─────────────────────────────────────────
    progress("Stage 2/5: Computing court homography...", _p(0.12))
    homography: Homography | None = None
    if request.calibration:
        try:
            homography = compute_homography(request.calibration)
            progress("Court homography computed from calibration", _p(0.15))
        except Exception as e:
            progress(f"Court homography failed: {e}. Continuing without zone mapping.", _p(0.15))
    else:
        progress("No court calibration provided. Zone mapping will use defaults.", _p(0.15))

    # ── Stage 3-5: Per-frame processing ──────────────────────────────────
    progress("Stages 3-5: Processing frames (detection, tracking, pose)...", _p(0.15))

    use_shuttle = shuttle_available()
    if use_shuttle:
        progress("TrackNetV3 available — shuttle tracking enabled", _p(0.16))
    else:
        progress("TrackNetV3 not available — using pose-based hit detection", _p(0.16))

    all_frame_data: list[FrameData] = []
    frame_data_map: dict[int, FrameData] = {}
    frame_buffer: list[np.ndarray] = []
    processed_frames = 0

    for seg in gameplay_segments:
        reset_tracker()
        cap.set(cv2.CAP_PROP_POS_FRAMES, seg.start_frame)
        frame_buffer.clear()

        skip = settings.frame_skip
        for frame_idx in range(seg.start_frame, seg.end_frame + 1):
            ret, frame = cap.read()
            if not ret:
                break

            if skip > 1 and (frame_idx - seg.start_frame) % skip != 0:
                continue

            timestamp = frame_idx / fps
            players = detect_players_in_frame(frame, homography)
            court_players = filter_court_players(players)

            shuttle: ShuttlePosition | None = None
            if use_shuttle:
                frame_buffer.append(frame)
                if len(frame_buffer) > 10:
                    frame_buffer.pop(0)
                if len(frame_buffer) >= 3:
                    shuttle_results = detect_shuttle(
                        frame_buffer[-3:], homography
                    )
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
            frame_data_map[frame_idx] = fd

            processed_frames += 1
            if processed_frames % 500 == 0:
                raw_pct = 0.15 + 0.65 * (processed_frames / total_frames)
                progress(
                    f"Processed {processed_frames}/{total_frames} frames",
                    _p(min(raw_pct, 0.80)),
                )

    cap.release()
    progress(f"Frame processing complete: {processed_frames} frames", _p(0.80))

    # ── Hit detection ────────────────────────────────────────────────────
    progress("Detecting hit frames...", _p(0.82))
    if use_shuttle:
        hits = detect_hits_from_trajectory(all_frame_data)
        progress(f"Trajectory-based hit detection: {len(hits)} hits", _p(0.85))
        if not hits:
            progress("Trajectory-based detection found 0 hits, falling back to pose-based...", _p(0.83))
            hits = detect_hits_from_poses(all_frame_data)
            progress(f"Pose-based fallback hit detection: {len(hits)} hits", _p(0.85))
    else:
        hits = detect_hits_from_poses(all_frame_data)
        progress(f"Pose-based hit detection: {len(hits)} hits", _p(0.85))

    if not hits:
        progress("No hits detected. Returning empty result.", 1.0)
        return AnalysisOutput(rallies=[], rally_count=0, shot_count=0)

    # ── Rally segmentation + shot classification ─────────────────────────
    progress("Segmenting rallies and classifying shots...", _p(0.87))
    rally_groups = segment_rallies(hits, frame_data_map, homography)
    rally_results = build_rally_results(rally_groups, frame_data_map, homography)

    total_shots = sum(len(r.shots) for r in rally_results)
    progress(
        f"Analysis complete: {len(rally_results)} rallies, {total_shots} shots",
        1.0,
    )

    return AnalysisOutput(
        rallies=rally_results,
        rally_count=len(rally_results),
        shot_count=total_shots,
    )
