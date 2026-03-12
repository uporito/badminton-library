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