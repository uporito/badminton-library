"""Stage 3: Player detection and tracking using YOLOv11 + ByteTrack."""

from __future__ import annotations

import logging
from pathlib import Path

import cv2
import numpy as np

from config import settings
from models import PlayerBox, Point2D, Side
from stages.court_detection import Homography, player_side_from_court_pos

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(settings.yolo_detect_model)
        logger.info("Loaded YOLO detection model: %s", settings.yolo_detect_model)
    return _model


def detect_players_in_frame(
    frame: np.ndarray,
    homography: Homography | None = None,
    *,
    persist: bool = True,
) -> list[PlayerBox]:
    """Detect and track players in a single frame.

    Uses YOLO person detection + ByteTrack for consistent track IDs.
    If a homography is provided, maps player positions to court coords and
    assigns each player to a side.
    """
    model = _get_model()

    results = model.track(
        frame,
        classes=[0],  # person class
        conf=settings.player_conf_threshold,
        iou=settings.player_iou_threshold,
        persist=persist,
        tracker="bytetrack.yaml",
        verbose=False,
    )

    players: list[PlayerBox] = []
    if not results or results[0].boxes is None:
        return players

    boxes = results[0].boxes
    for i in range(len(boxes)):
        xyxy = boxes.xyxy[i].cpu().numpy()
        x1, y1, x2, y2 = float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3])

        track_id = -1
        if boxes.id is not None:
            track_id = int(boxes.id[i].item())

        cx = (x1 + x2) / 2
        # Use bottom-center as the "foot" position for court mapping
        foot_y = y2
        foot_x = cx

        court_pos = None
        side = None
        if homography is not None:
            try:
                court_x, court_y = homography.pixel_to_court(foot_x, foot_y)
                if 0 <= court_x <= homography.court_width and 0 <= court_y <= homography.court_length:
                    court_pos = Point2D(x=court_x, y=court_y)
                    side = player_side_from_court_pos(court_y, homography)
            except Exception:
                pass

        players.append(PlayerBox(
            track_id=track_id,
            bbox=(x1, y1, x2, y2),
            center=Point2D(x=cx, y=(y1 + y2) / 2),
            court_pos=court_pos,
            side=side,
        ))

    return players


def filter_court_players(
    players: list[PlayerBox],
    max_players: int = 4,
) -> list[PlayerBox]:
    """Filter to only players on the court (have court positions) and limit count."""
    on_court = [p for p in players if p.court_pos is not None]
    if len(on_court) <= max_players:
        return on_court

    # Keep the ones closest to court center
    center_x = settings.court_width / 2
    center_y = settings.court_length / 2
    on_court.sort(
        key=lambda p: (
            (p.court_pos.x - center_x) ** 2 + (p.court_pos.y - center_y) ** 2
            if p.court_pos else float("inf")
        )
    )
    return on_court[:max_players]


def reset_tracker():
    """Reset the YOLO tracker state (call between segments/videos)."""
    global _model
    _model = None
