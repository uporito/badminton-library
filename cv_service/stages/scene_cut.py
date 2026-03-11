"""Stage 1: Scene cut detection using PySceneDetect.

Splits a video into continuous segments, filtering out non-gameplay frames
(replays, slow-motion, intros) in broadcast footage.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from scenedetect import detect, ContentDetector, AdaptiveDetector
from scenedetect.frame_timecode import FrameTimecode

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class VideoSegment:
    start_frame: int
    end_frame: int
    start_sec: float
    end_sec: float
    is_gameplay: bool = True


def detect_scene_cuts(
    video_path: str,
    fps: float,
    total_frames: int,
    *,
    threshold: float | None = None,
    min_scene_len_sec: float | None = None,
) -> list[VideoSegment]:
    """Detect scene cuts and return gameplay segments.

    For amateur footage with no cuts, returns a single segment spanning the
    whole video. For broadcast footage, splits at hard cuts and marks short
    segments (likely replays / transitions) as non-gameplay.
    """
    thresh = threshold or settings.scene_cut_threshold
    min_len = min_scene_len_sec or settings.scene_cut_min_scene_len_sec

    try:
        scene_list = detect(
            video_path,
            ContentDetector(threshold=thresh, min_scene_len=int(min_len * fps)),
        )
    except Exception:
        logger.warning("Scene detection failed, treating entire video as one segment")
        return [VideoSegment(
            start_frame=0,
            end_frame=total_frames - 1,
            start_sec=0.0,
            end_sec=(total_frames - 1) / fps,
        )]

    if not scene_list:
        return [VideoSegment(
            start_frame=0,
            end_frame=total_frames - 1,
            start_sec=0.0,
            end_sec=(total_frames - 1) / fps,
        )]

    segments: list[VideoSegment] = []
    for start_tc, end_tc in scene_list:
        sf = start_tc.get_frames()
        ef = end_tc.get_frames()
        duration_sec = (ef - sf) / fps

        is_gameplay = duration_sec >= 3.0

        segments.append(VideoSegment(
            start_frame=sf,
            end_frame=ef,
            start_sec=sf / fps,
            end_sec=ef / fps,
            is_gameplay=is_gameplay,
        ))

    gameplay = [s for s in segments if s.is_gameplay]
    if not gameplay:
        for s in segments:
            s.is_gameplay = True
        return segments

    logger.info(
        "Scene detection: %d total segments, %d gameplay",
        len(segments),
        len(gameplay),
    )
    return segments


def merge_gameplay_segments(
    segments: list[VideoSegment],
    gap_threshold_sec: float = 1.0,
) -> list[VideoSegment]:
    """Merge consecutive gameplay segments that are close together."""
    gameplay = [s for s in segments if s.is_gameplay]
    if len(gameplay) <= 1:
        return gameplay

    merged: list[VideoSegment] = [gameplay[0]]
    for seg in gameplay[1:]:
        prev = merged[-1]
        if seg.start_sec - prev.end_sec <= gap_threshold_sec:
            merged[-1] = VideoSegment(
                start_frame=prev.start_frame,
                end_frame=seg.end_frame,
                start_sec=prev.start_sec,
                end_sec=seg.end_sec,
                is_gameplay=True,
            )
        else:
            merged.append(seg)

    return merged
