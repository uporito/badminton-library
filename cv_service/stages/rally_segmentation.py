"""Rally segmentation: group hit events into rallies.

Uses gap detection (time between consecutive hits) and service detection
to segment a match into individual rallies.
"""

from __future__ import annotations

import logging

from config import settings
from models import (
    HitEvent,
    FrameData,
    RallyResult,
    ShotResult,
    Side,
    AnalysisFeatures,
)
from stages.court_detection import Homography
from stages.shot_classification import build_shot_result

logger = logging.getLogger(__name__)


def segment_rallies(
    hits: list[HitEvent],
    frame_data_map: dict[int, FrameData],
    homography: Homography | None,
    *,
    gap_seconds: float | None = None,
) -> list[list[HitEvent]]:
    """Split a flat list of hit events into rally groups.

    A new rally starts when:
    1. The gap between consecutive hits exceeds `gap_seconds`, OR
    2. A hit is classified as a serve (future enhancement).
    """
    gap = gap_seconds or settings.rally_gap_seconds

    if not hits:
        return []

    rallies: list[list[HitEvent]] = [[hits[0]]]

    for i in range(1, len(hits)):
        time_gap = hits[i].timestamp - hits[i - 1].timestamp
        if time_gap > gap:
            rallies.append([hits[i]])
        else:
            rallies[-1].append(hits[i])

    # Filter out rallies with too few hits (likely false positives)
    rallies = [r for r in rallies if len(r) >= 2]

    logger.info("Segmented %d hits into %d rallies", len(hits), len(rallies))
    return rallies


def build_rally_results(
    rally_groups: list[list[HitEvent]],
    frame_data_map: dict[int, FrameData],
    homography: Homography | None,
    features: AnalysisFeatures | None = None,
) -> list[RallyResult]:
    """Convert rally hit groups into structured RallyResult objects."""
    if features is None:
        features = AnalysisFeatures()

    results: list[RallyResult] = []

    for rally_idx, rally_hits in enumerate(rally_groups):
        shots: list[ShotResult] = []

        for i, hit in enumerate(rally_hits):
            prev_hit = rally_hits[i - 1] if i > 0 else None
            next_hit = rally_hits[i + 1] if i < len(rally_hits) - 1 else None
            is_first = i == 0
            is_last = i == len(rally_hits) - 1

            fd = frame_data_map.get(hit.frame_idx)

            shot = build_shot_result(
                hit=hit,
                prev_hit=prev_hit,
                next_hit=next_hit,
                frame_data_at_hit=fd,
                homography=homography,
                is_first_in_rally=is_first,
                is_last_in_rally=is_last,
                rally_idx=rally_idx,
                features=features,
            )
            shots.append(shot)

        won_by_me = _determine_rally_winner(shots, features)

        results.append(RallyResult(
            won_by_me=won_by_me,
            shots=shots,
        ))

    return results


def _determine_rally_winner(shots: list[ShotResult], features: AnalysisFeatures | None = None) -> bool | None:
    """Determine rally winner from the last shot's outcome and player.

    Returns None when outcome detection is disabled.
    """
    if features is not None and not features.outcome:
        return None

    if not shots:
        return False

    last = shots[-1]

    if last.outcome.value == "winner":
        return last.player.value in ("me", "partner")
    elif last.outcome.value == "error":
        return last.player.value not in ("me", "partner")

    return False
