# test_court_detection.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import math
from models import CourtCalibration, Point2D, Side, Zone
from stages.court_detection import (
    compute_homography, player_side_from_court_pos, _reference_corners,
)


def _make_calibration(near_side="me"):
    """Simplest calibration: pixel coords = court coords * 100 (no perspective)."""
    return CourtCalibration(
        top_left=Point2D(x=0, y=0),
        top_right=Point2D(x=610, y=0),
        bottom_right=Point2D(x=610, y=1340),
        bottom_left=Point2D(x=0, y=1340),
        near_side=Side(near_side),
    )


class TestReferenceCorners:
    def test_shape(self):
        ref = _reference_corners()
        assert ref.shape == (4, 2)

    def test_dimensions(self):
        ref = _reference_corners()
        assert ref[1, 0] == 6.1    # court_width
        assert ref[2, 1] == 13.4   # court_length


class TestComputeHomography:
    def test_returns_homography(self):
        H = compute_homography(_make_calibration())
        assert H.matrix.shape == (3, 3)
        assert H.inv_matrix.shape == (3, 3)

    def test_near_side_stored(self):
        H = compute_homography(_make_calibration("opponent"))
        assert H.near_side == Side.opponent

    def test_court_dimensions_stored(self):
        H = compute_homography(_make_calibration())
        assert H.court_width == 6.1
        assert H.court_length == 13.4
        assert H.half_court == 6.7


class TestPixelToCourtMapping:
    def test_corners_map_correctly(self):
        """With a simple linear calibration, corners should map to reference."""
        H = compute_homography(_make_calibration())
        # top-left pixel (0,0) → court (0,0)
        cx, cy = H.pixel_to_court(0, 0)
        assert abs(cx) < 0.5
        assert abs(cy) < 0.5

        # bottom-right pixel (610, 1340) → court (6.1, 13.4)
        cx, cy = H.pixel_to_court(610, 1340)
        assert abs(cx - 6.1) < 0.5
        assert abs(cy - 13.4) < 0.5

    def test_center_maps_to_center(self):
        H = compute_homography(_make_calibration())
        cx, cy = H.pixel_to_court(305, 670)
        assert abs(cx - 3.05) < 0.5
        assert abs(cy - 6.7) < 0.5

    def test_roundtrip(self):
        """pixel → court → pixel should return approximately the same point."""
        H = compute_homography(_make_calibration())
        px, py = 200.0, 500.0
        cx, cy = H.pixel_to_court(px, py)
        px2, py2 = H.court_to_pixel(cx, cy)
        assert abs(px2 - px) < 1.0
        assert abs(py2 - py) < 1.0


class TestCourtToZone:
    def test_near_side_me_baseline(self):
        """Near baseline (y=13.0) with near_side=me should be Side.me, *_back."""
        H = compute_homography(_make_calibration("me"))
        side, zone = H.court_to_zone(3.0, 13.0)
        assert side == Side.me
        assert "back" in zone.value

    def test_far_side_net(self):
        """Far side near net (y≈half_court) with near_side=me should be Side.opponent, *_front."""
        H = compute_homography(_make_calibration("me"))
        # y=6.0 is on far side (<=6.7) and in the "front" third (near net), so zone should be *_front
        side, zone = H.court_to_zone(3.0, 6.0)
        assert side == Side.opponent
        assert "front" in zone.value

    def test_left_center_right(self):
        """Test lateral zone assignment across the court."""
        H = compute_homography(_make_calibration())
        _, zone_left = H.court_to_zone(0.5, 10.0)
        _, zone_center = H.court_to_zone(3.0, 10.0)
        _, zone_right = H.court_to_zone(5.5, 10.0)
        assert "left" in zone_left.value
        assert "center" in zone_center.value
        assert "right" in zone_right.value

    def test_all_9_zones_reachable(self):
        """Sampling the 9 grid cells should produce all 9 unique zone values."""
        H = compute_homography(_make_calibration())
        zones_seen = set()
        third_x = 6.1 / 3
        third_y = 6.7 / 3
        for xi in range(3):
            for yi in range(3):
                x = third_x * xi + third_x / 2
                y = third_y * yi + third_y / 2  # stays in near half
                _, zone = H.court_to_zone(x, y)
                zones_seen.add(zone)
        assert len(zones_seen) == 9

    def test_clamping_out_of_bounds(self):
        """Coordinates outside court should be clamped, not crash."""
        H = compute_homography(_make_calibration())
        side, zone = H.court_to_zone(-5.0, 20.0)
        assert isinstance(side, Side)
        assert isinstance(zone, Zone)


class TestPlayerSideFromCourtPos:
    def test_near_half_is_me(self):
        H = compute_homography(_make_calibration("me"))
        assert player_side_from_court_pos(10.0, H) == Side.me

    def test_far_half_is_opponent(self):
        H = compute_homography(_make_calibration("me"))
        assert player_side_from_court_pos(3.0, H) == Side.opponent

    def test_swapped_when_near_is_opponent(self):
        H = compute_homography(_make_calibration("opponent"))
        assert player_side_from_court_pos(10.0, H) == Side.opponent
        assert player_side_from_court_pos(3.0, H) == Side.me