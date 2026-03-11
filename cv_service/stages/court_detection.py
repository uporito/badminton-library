"""Stage 2: Court detection and homography.

Supports manual calibration (user provides 4 court corners) and computes
the homography matrix to map pixel coordinates to normalized court space.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from config import settings
from models import CourtCalibration, Point2D, Side, Zone

logger = logging.getLogger(__name__)

# Reference court coordinates in meters.
# Origin is top-left of the full court (far-left from camera perspective).
# X = across court (0..court_width), Y = along court (0..court_length).
COURT_REF_POINTS = None  # computed lazily


def _reference_corners() -> np.ndarray:
    """Full-court reference corners: TL, TR, BR, BL in meters."""
    w = settings.court_width
    l = settings.court_length
    return np.array([
        [0.0, 0.0],       # top-left  (far-left)
        [w,   0.0],       # top-right (far-right)
        [w,   l],         # bottom-right (near-right)
        [0.0, l],         # bottom-left  (near-left)
    ], dtype=np.float32)


@dataclass
class Homography:
    matrix: np.ndarray            # 3x3 pixel→court
    inv_matrix: np.ndarray        # 3x3 court→pixel
    near_side: Side               # which player is closest to camera
    court_width: float
    court_length: float
    half_court: float

    def pixel_to_court(self, px: float, py: float) -> tuple[float, float]:
        pt = np.array([[[px, py]]], dtype=np.float32)
        mapped = cv2.perspectiveTransform(pt, self.matrix)
        return float(mapped[0, 0, 0]), float(mapped[0, 0, 1])

    def court_to_pixel(self, cx: float, cy: float) -> tuple[float, float]:
        pt = np.array([[[cx, cy]]], dtype=np.float32)
        mapped = cv2.perspectiveTransform(pt, self.inv_matrix)
        return float(mapped[0, 0, 0]), float(mapped[0, 0, 1])

    def court_to_zone(self, cx: float, cy: float) -> tuple[Side, Zone]:
        """Map court coordinates to (side, zone) using a 3x3 grid per half."""
        w = self.court_width
        h = self.court_length
        half = self.half_court

        cy_clamped = max(0.0, min(cy, h))
        cx_clamped = max(0.0, min(cx, w))

        if cy_clamped <= half:
            side_raw = "far"
            local_y = cy_clamped
        else:
            side_raw = "near"
            local_y = h - cy_clamped

        if self.near_side == Side.me:
            side = Side.opponent if side_raw == "far" else Side.me
        else:
            side = Side.me if side_raw == "far" else Side.opponent

        # Along-court zones (from net = 0 to baseline = half)
        zone_y_thirds = half / 3.0
        if local_y < zone_y_thirds:
            depth = "front"
        elif local_y < 2 * zone_y_thirds:
            depth = "mid"
        else:
            depth = "back"

        # Across-court zones
        zone_x_thirds = w / 3.0
        if cx_clamped < zone_x_thirds:
            lateral = "left"
        elif cx_clamped < 2 * zone_x_thirds:
            lateral = "center"
        else:
            lateral = "right"

        zone_name = f"{lateral}_{depth}"
        return side, Zone(zone_name)


def compute_homography(calibration: CourtCalibration) -> Homography:
    """Compute homography from 4 user-provided pixel corners."""
    pixel_pts = np.array([
        [calibration.top_left.x,     calibration.top_left.y],
        [calibration.top_right.x,    calibration.top_right.y],
        [calibration.bottom_right.x, calibration.bottom_right.y],
        [calibration.bottom_left.x,  calibration.bottom_left.y],
    ], dtype=np.float32)

    court_pts = _reference_corners()

    H, mask = cv2.findHomography(pixel_pts, court_pts)
    if H is None:
        raise ValueError("Could not compute homography from provided corners")

    H_inv, _ = cv2.findHomography(court_pts, pixel_pts)

    return Homography(
        matrix=H,
        inv_matrix=H_inv,
        near_side=calibration.near_side,
        court_width=settings.court_width,
        court_length=settings.court_length,
        half_court=settings.half_court_length,
    )


def player_side_from_court_pos(
    cy: float, homography: Homography
) -> Side:
    """Determine which side of the court a player is on."""
    if cy <= homography.half_court:
        raw = "far"
    else:
        raw = "near"

    if homography.near_side == Side.me:
        return Side.opponent if raw == "far" else Side.me
    return Side.me if raw == "far" else Side.opponent
