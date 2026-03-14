"""Stage 6: Shot classification.

Classifies each hit into a shot type using heuristic rules.
Future: LSTM / BST model-based classification.
"""

from __future__ import annotations

import logging
import math

from models import (
    ShotType,
    Outcome,
    Side,
    Zone,
    ShotPlayer,
    ShotResult,
    HitEvent,
    FrameData,
    ShuttlePosition,
    Point2D,
    AnalysisFeatures,
)
from stages.court_detection import Homography

logger = logging.getLogger(__name__)


def classify_shot_heuristic(
    hit: HitEvent,
    prev_hit: HitEvent | None,
    frame_data_at_hit: FrameData | None,
    homography: Homography | None,
    is_first_in_rally: bool,
    rally_idx: int,
) -> ShotType:
    """Classify a shot using heuristic rules on shuttle trajectory and player position."""

    if is_first_in_rally:
        return ShotType.serve

    if hit.shuttle_court is None or prev_hit is None or prev_hit.shuttle_court is None:
        return ShotType.clear

    dx = hit.shuttle_court.x - prev_hit.shuttle_court.x
    dy = hit.shuttle_court.y - prev_hit.shuttle_court.y
    distance = math.sqrt(dx * dx + dy * dy)

    dt = hit.timestamp - prev_hit.timestamp
    speed = distance / dt if dt > 0 else 0

    shuttle_y = hit.shuttle_court.y
    half = homography.half_court if homography else 6.7

    is_near_net = False
    if homography:
        net_y = half
        is_near_net = abs(shuttle_y - net_y) < half * 0.25

    is_steep = False
    if prev_hit.shuttle_px and hit.shuttle_px:
        pixel_dy = hit.shuttle_px.y - prev_hit.shuttle_px.y
        pixel_dx = hit.shuttle_px.x - prev_hit.shuttle_px.x
        pixel_dist = math.sqrt(pixel_dx ** 2 + pixel_dy ** 2)
        if pixel_dist > 0:
            angle = abs(math.degrees(math.atan2(abs(pixel_dy), abs(pixel_dx))))
            is_steep = angle > 60

    if speed > 15 and is_steep:
        return ShotType.smash

    if is_near_net and distance < half * 0.3:
        return ShotType.net

    if is_steep and speed > 8:
        return ShotType.drop

    if distance > half * 0.8:
        return ShotType.clear

    horizontal_ratio = abs(dx) / (abs(dy) + 1e-6)
    if horizontal_ratio > 1.5 and not is_steep:
        return ShotType.drive

    if hit.shuttle_court.y < prev_hit.shuttle_court.y and speed < 10:
        return ShotType.lift

    if speed > 10 and is_steep:
        return ShotType.block

    return ShotType.clear


def determine_zones(
    hit: HitEvent,
    prev_hit: HitEvent | None,
    homography: Homography | None,
) -> tuple[Side, Zone, Side, Zone]:
    """Determine zone_from and zone_to for a shot.

    Returns (zone_from_side, zone_from, zone_to_side, zone_to).
    """
    default_side = Side.me
    default_zone = Zone.center_mid

    if homography is None:
        return default_side, default_zone, default_side, default_zone

    if prev_hit and prev_hit.shuttle_court:
        from_side, from_zone = homography.court_to_zone(
            prev_hit.shuttle_court.x, prev_hit.shuttle_court.y
        )
    elif hit.player_side:
        from_side = hit.player_side
        from_zone = default_zone
    else:
        from_side = default_side
        from_zone = default_zone

    if hit.shuttle_court:
        to_side, to_zone = homography.court_to_zone(
            hit.shuttle_court.x, hit.shuttle_court.y
        )
    else:
        to_side = Side.opponent if from_side == Side.me else Side.me
        to_zone = default_zone

    return from_side, from_zone, to_side, to_zone


def determine_outcome_heuristic(
    hit: HitEvent,
    next_hit: HitEvent | None,
    is_last_in_rally: bool,
    homography: Homography | None,
) -> Outcome:
    """Determine shot outcome. Only the last shot of a rally has a meaningful outcome."""
    if not is_last_in_rally:
        return Outcome.neither

    if hit.shuttle_court and homography:
        x, y = hit.shuttle_court.x, hit.shuttle_court.y
        in_bounds = (
            0 <= x <= homography.court_width
            and 0 <= y <= homography.court_length
        )
        if not in_bounds:
            return Outcome.error
        return Outcome.winner

    return Outcome.winner


def hit_to_player(hit: HitEvent) -> ShotPlayer:
    """Map a hit event's side to the ShotPlayer enum."""
    if hit.player_side == Side.me:
        return ShotPlayer.me
    elif hit.player_side == Side.opponent:
        return ShotPlayer.opponent
    return ShotPlayer.me


def build_shot_result(
    hit: HitEvent,
    prev_hit: HitEvent | None,
    next_hit: HitEvent | None,
    frame_data_at_hit: FrameData | None,
    homography: Homography | None,
    is_first_in_rally: bool,
    is_last_in_rally: bool,
    rally_idx: int,
    features: AnalysisFeatures | None = None,
) -> ShotResult:
    """Build a complete ShotResult from a hit event."""
    if features is None:
        features = AnalysisFeatures()

    if features.shot_type:
        shot_type = classify_shot_heuristic(
            hit, prev_hit, frame_data_at_hit, homography, is_first_in_rally, rally_idx,
        )
    else:
        shot_type = ShotType.clear

    if features.placement:
        from_side, from_zone, to_side, to_zone = determine_zones(hit, prev_hit, homography)
    else:
        from_side, from_zone, to_side, to_zone = (
            Side.me, Zone.center_mid, Side.me, Zone.center_mid
        )

    if features.outcome:
        outcome = determine_outcome_heuristic(hit, next_hit, is_last_in_rally, homography)
    else:
        outcome = Outcome.neither

    player = hit_to_player(hit)

    return ShotResult(
        shot_type=shot_type,
        player=player,
        zone_from_side=from_side,
        zone_from=from_zone,
        zone_to_side=to_side,
        zone_to=to_zone,
        outcome=outcome,
        timestamp=hit.timestamp,
    )
