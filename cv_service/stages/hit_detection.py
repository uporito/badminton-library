"""Hit-frame detection: identifies frames where a player strikes the shuttle.

Primary method: shuttle trajectory direction change (requires TrackNetV3).
Fallback method: pose-based arm swing detection.
"""

from __future__ import annotations

import logging
import math

import numpy as np

from config import settings
from models import (
    HitEvent,
    FrameData,
    Point2D,
    ShuttlePosition,
    Side,
)

logger = logging.getLogger(__name__)


def detect_hits_from_trajectory(
    frame_data: list[FrameData],
    *,
    angle_threshold_deg: float | None = None,
    min_gap_frames: int | None = None,
) -> list[HitEvent]:
    """Detect hits by finding shuttle direction reversals.

    A hit is detected when the shuttle's velocity vector changes direction
    by more than `angle_threshold_deg` degrees.
    """
    angle_thresh = angle_threshold_deg or settings.hit_angle_change_deg
    gap = min_gap_frames or settings.hit_min_gap_frames

    positions: list[tuple[int, float, float, float, FrameData]] = []
    for fd in frame_data:
        if fd.shuttle is not None:
            positions.append((
                fd.frame_idx,
                fd.timestamp,
                fd.shuttle.x,
                fd.shuttle.y,
                fd,
            ))

    if len(positions) < 3:
        return []

    velocities: list[tuple[float, float]] = []
    for i in range(1, len(positions)):
        dt = positions[i][1] - positions[i - 1][1]
        if dt <= 0:
            dt = 1e-6
        vx = (positions[i][2] - positions[i - 1][2]) / dt
        vy = (positions[i][3] - positions[i - 1][3]) / dt
        velocities.append((vx, vy))

    hits: list[HitEvent] = []
    last_hit_frame = -gap - 1

    for i in range(1, len(velocities)):
        v1 = velocities[i - 1]
        v2 = velocities[i]

        mag1 = math.sqrt(v1[0] ** 2 + v1[1] ** 2)
        mag2 = math.sqrt(v2[0] ** 2 + v2[1] ** 2)
        if mag1 < 1e-6 or mag2 < 1e-6:
            continue

        dot = v1[0] * v2[0] + v1[1] * v2[1]
        cos_angle = max(-1.0, min(1.0, dot / (mag1 * mag2)))
        angle_deg = math.degrees(math.acos(cos_angle))

        frame_idx = positions[i + 1][0]  # i+1 because velocities are offset by 1
        if angle_deg >= angle_thresh and (frame_idx - last_hit_frame) >= gap:
            fd = positions[i + 1][4]

            nearest_player = _find_nearest_player(fd)

            hits.append(HitEvent(
                frame_idx=frame_idx,
                timestamp=fd.timestamp,
                player_track_id=nearest_player[0] if nearest_player else None,
                player_side=nearest_player[1] if nearest_player else None,
                shuttle_px=Point2D(x=fd.shuttle.x, y=fd.shuttle.y) if fd.shuttle else None,
                shuttle_court=fd.shuttle.court_pos if fd.shuttle else None,
            ))
            last_hit_frame = frame_idx

    return hits


def detect_hits_from_poses(
    frame_data: list[FrameData],
    *,
    min_gap_frames: int | None = None,
) -> list[HitEvent]:
    """Fallback hit detection using arm-raise pose analysis.

    Less accurate than trajectory-based detection but works without
    shuttle tracking.
    """
    from stages.pose_estimation import detect_arm_raised

    gap = min_gap_frames or settings.hit_min_gap_frames
    hits: list[HitEvent] = []
    last_hit_frame = -gap - 1

    for fd in frame_data:
        if fd.frame_idx - last_hit_frame < gap:
            continue

        for kp in fd.keypoints:
            if detect_arm_raised(kp):
                player = None
                for p in fd.players:
                    if p.track_id == kp.track_id:
                        player = p
                        break

                hits.append(HitEvent(
                    frame_idx=fd.frame_idx,
                    timestamp=fd.timestamp,
                    player_track_id=kp.track_id,
                    player_side=player.side if player else None,
                ))
                last_hit_frame = fd.frame_idx
                break  # one hit per frame max

    return hits


def _find_nearest_player(
    fd: FrameData,
) -> tuple[int, Side | None] | None:
    """Find the player closest to the shuttle in a frame."""
    if fd.shuttle is None or not fd.players:
        return None

    sx, sy = fd.shuttle.x, fd.shuttle.y
    best_dist = float("inf")
    best_player = None

    for p in fd.players:
        dist = (p.center.x - sx) ** 2 + (p.center.y - sy) ** 2
        if dist < best_dist:
            best_dist = dist
            best_player = (p.track_id, p.side)

    return best_player
