"""Stage 5: Pose estimation using YOLOv11-Pose."""

from __future__ import annotations

import logging

import cv2
import numpy as np

from config import settings
from models import Keypoints, PlayerBox

logger = logging.getLogger(__name__)

_model = None

# COCO keypoint indices
NOSE = 0
LEFT_SHOULDER = 5
RIGHT_SHOULDER = 6
LEFT_ELBOW = 7
RIGHT_ELBOW = 8
LEFT_WRIST = 9
RIGHT_WRIST = 10
LEFT_HIP = 11
RIGHT_HIP = 12


def _get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(settings.yolo_pose_model)
        _model.to(settings.device)
        logger.info("Loaded YOLO pose model: %s on %s", settings.yolo_pose_model, settings.device)
    return _model


def estimate_poses(
    frame: np.ndarray,
    players: list[PlayerBox] | None = None,
) -> list[Keypoints]:
    """Estimate poses for all detected people in a frame.

    If `players` is provided, only extract poses for those bounding boxes.
    Otherwise, run full-frame pose detection.
    """
    model = _get_model()

    results = model(
        frame,
        classes=[0],
        conf=settings.player_conf_threshold,
        verbose=False,
    )

    keypoints_list: list[Keypoints] = []

    if not results or results[0].keypoints is None:
        return keypoints_list

    kps = results[0].keypoints
    boxes = results[0].boxes

    for i in range(len(kps)):
        data = kps.data[i].cpu().numpy().flatten().tolist()

        track_id = -1
        if players and boxes is not None and i < len(boxes):
            box_center_x = float((boxes.xyxy[i][0] + boxes.xyxy[i][2]) / 2)
            box_center_y = float((boxes.xyxy[i][1] + boxes.xyxy[i][3]) / 2)
            best_dist = float("inf")
            for p in players:
                dist = (p.center.x - box_center_x) ** 2 + (p.center.y - box_center_y) ** 2
                if dist < best_dist:
                    best_dist = dist
                    track_id = p.track_id

        keypoints_list.append(Keypoints(data=data, track_id=track_id))

    return keypoints_list


def get_wrist_positions(kp: Keypoints) -> tuple[tuple[float, float] | None, tuple[float, float] | None]:
    """Extract left and right wrist positions from keypoints.
    Returns ((lx, ly), (rx, ry)) or None if confidence too low.
    """
    data = kp.data
    if len(data) < 33:  # 11 keypoints * 3 values each minimum
        return None, None

    def _get(idx: int) -> tuple[float, float] | None:
        base = idx * 3
        if base + 2 >= len(data):
            return None
        x, y, conf = data[base], data[base + 1], data[base + 2]
        return (x, y) if conf > 0.3 else None

    return _get(LEFT_WRIST), _get(RIGHT_WRIST)


def get_shoulder_positions(kp: Keypoints) -> tuple[tuple[float, float] | None, tuple[float, float] | None]:
    """Extract left and right shoulder positions."""
    data = kp.data

    def _get(idx: int) -> tuple[float, float] | None:
        base = idx * 3
        if base + 2 >= len(data):
            return None
        x, y, conf = data[base], data[base + 1], data[base + 2]
        return (x, y) if conf > 0.3 else None

    return _get(LEFT_SHOULDER), _get(RIGHT_SHOULDER)


def detect_arm_raised(kp: Keypoints, threshold_ratio: float = 0.8) -> bool:
    """Detect if either arm is raised above shoulder (swing indicator).

    Returns True if wrist is significantly above the corresponding shoulder.
    """
    left_wrist, right_wrist = get_wrist_positions(kp)
    left_shoulder, right_shoulder = get_shoulder_positions(kp)

    for wrist, shoulder in [(left_wrist, left_shoulder), (right_wrist, right_shoulder)]:
        if wrist is None or shoulder is None:
            continue
        shoulder_to_hip_approx = 50
        if shoulder[1] - wrist[1] > shoulder_to_hip_approx * threshold_ratio:
            return True

    return False
