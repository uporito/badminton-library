# test_hit_detection.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import FrameData, ShuttlePosition, Point2D, PlayerBox, Side, Keypoints
from stages.hit_detection import (
    detect_hits_from_trajectory,
    detect_hits_from_poses,
    _find_nearest_player,
)


def _make_fd(idx, ts, sx=None, sy=None, players=None, keypoints=None):
    shuttle = ShuttlePosition(x=sx, y=sy) if sx is not None else None
    return FrameData(
        frame_idx=idx,
        timestamp=ts,
        shuttle=shuttle,
        players=players or [],
        keypoints=keypoints or [],
    )


class TestTrajectoryHitDetection:
    def test_no_shuttle_data(self):
        """Empty shuttle data should return no hits."""
        frames = [_make_fd(i, i / 30.0) for i in range(100)]
        hits = detect_hits_from_trajectory(frames)
        assert hits == []

    def test_straight_line_no_hits(self):
        """Shuttle moving in a straight line should produce no hits (no direction change)."""
        frames = [_make_fd(i, i / 30.0, sx=float(i), sy=0.0) for i in range(100)]
        hits = detect_hits_from_trajectory(frames)
        assert len(hits) == 0

    def test_reversal_produces_hit(self):
        """Shuttle going right then sharply left should produce a hit."""
        frames = []
        for i in range(20):
            frames.append(_make_fd(i, i / 30.0, sx=float(i * 10), sy=100.0))
        for i in range(20, 40):
            frames.append(_make_fd(i, i / 30.0, sx=float((40 - i) * 10), sy=100.0))
        hits = detect_hits_from_trajectory(frames, angle_threshold_deg=60)
        assert len(hits) >= 1

    def test_multiple_reversals(self):
        """Zigzag trajectory should produce multiple hits."""
        frames = []
        for i in range(100):
            if (i // 15) % 2 == 0:
                x = float(i * 10)
            else:
                x = float((30 - (i % 15)) * 10)
            frames.append(_make_fd(i, i / 30.0, sx=x, sy=200.0))
        hits = detect_hits_from_trajectory(frames, angle_threshold_deg=45, min_gap_frames=3)
        assert len(hits) >= 2

    def test_min_gap_debounce(self):
        """Two quick reversals within min_gap should only produce one hit."""
        frames = []
        for i in range(10):
            frames.append(_make_fd(i, i / 30.0, sx=float(i * 20), sy=0.0))
        frames.append(_make_fd(10, 10 / 30.0, sx=160.0, sy=0.0))
        frames.append(_make_fd(11, 11 / 30.0, sx=180.0, sy=0.0))
        frames.append(_make_fd(12, 12 / 30.0, sx=140.0, sy=0.0))
        hits = detect_hits_from_trajectory(frames, min_gap_frames=20)
        assert len(hits) <= 1

    def test_hit_has_timestamp(self):
        frames = []
        for i in range(15):
            frames.append(_make_fd(i, i / 30.0, sx=float(i * 10), sy=100.0))
        for i in range(15, 30):
            frames.append(_make_fd(i, i / 30.0, sx=float((30 - i) * 10), sy=100.0))
        hits = detect_hits_from_trajectory(frames, angle_threshold_deg=60)
        if hits:
            assert hits[0].timestamp > 0
            assert hits[0].frame_idx > 0


class TestFindNearestPlayer:
    def test_returns_closest(self):
        p1 = PlayerBox(track_id=1, bbox=(0,0,20,40), center=Point2D(x=10, y=20), side=Side.me)
        p2 = PlayerBox(track_id=2, bbox=(200,0,220,40), center=Point2D(x=210, y=20), side=Side.opponent)
        fd = _make_fd(0, 0.0, sx=15.0, sy=25.0, players=[p1, p2])
        result = _find_nearest_player(fd)
        assert result is not None
        assert result[0] == 1  # track_id of closer player
        assert result[1] == Side.me

    def test_no_players(self):
        fd = _make_fd(0, 0.0, sx=100.0, sy=100.0)
        assert _find_nearest_player(fd) is None

    def test_no_shuttle(self):
        p1 = PlayerBox(track_id=1, bbox=(0,0,20,40), center=Point2D(x=10, y=20))
        fd = _make_fd(0, 0.0, players=[p1])
        assert _find_nearest_player(fd) is None