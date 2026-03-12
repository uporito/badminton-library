# test_pose_utils.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import Keypoints
from stages.pose_estimation import (
    get_wrist_positions, get_shoulder_positions, detect_arm_raised,
    LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST,
)


def _make_keypoints(overrides=None):
    """Create 17 COCO keypoints (x, y, conf). All at (100, 200, 0.9) by default."""
    data = [100.0, 200.0, 0.9] * 17
    if overrides:
        for idx, (x, y, c) in overrides.items():
            base = idx * 3
            data[base] = x
            data[base + 1] = y
            data[base + 2] = c
    return Keypoints(data=data, track_id=1)


class TestGetWristPositions:
    def test_returns_positions(self):
        kp = _make_keypoints({LEFT_WRIST: (50, 60, 0.8), RIGHT_WRIST: (150, 60, 0.8)})
        left, right = get_wrist_positions(kp)
        assert left == (50, 60)
        assert right == (150, 60)

    def test_low_confidence_returns_none(self):
        kp = _make_keypoints({LEFT_WRIST: (50, 60, 0.1), RIGHT_WRIST: (150, 60, 0.1)})
        left, right = get_wrist_positions(kp)
        assert left is None
        assert right is None

    def test_too_short_data(self):
        kp = Keypoints(data=[0.0] * 9, track_id=1)
        left, right = get_wrist_positions(kp)
        assert left is None and right is None


class TestGetShoulderPositions:
    def test_returns_positions(self):
        kp = _make_keypoints({LEFT_SHOULDER: (80, 100, 0.9), RIGHT_SHOULDER: (120, 100, 0.9)})
        left, right = get_shoulder_positions(kp)
        assert left == (80, 100)
        assert right == (120, 100)


class TestDetectArmRaised:
    def test_arm_raised(self):
        """Wrist well above shoulder → arm raised."""
        kp = _make_keypoints({
            LEFT_SHOULDER: (100, 200, 0.9),
            LEFT_WRIST: (100, 100, 0.9),  # 100px above shoulder
            RIGHT_SHOULDER: (150, 200, 0.9),
            RIGHT_WRIST: (150, 300, 0.9),  # below shoulder
        })
        assert detect_arm_raised(kp) is True

    def test_arm_not_raised(self):
        """Wrists at or below shoulders → not raised."""
        kp = _make_keypoints({
            LEFT_SHOULDER: (100, 200, 0.9),
            LEFT_WRIST: (100, 220, 0.9),
            RIGHT_SHOULDER: (150, 200, 0.9),
            RIGHT_WRIST: (150, 250, 0.9),
        })
        assert detect_arm_raised(kp) is False

    def test_low_confidence_not_raised(self):
        """If keypoints have low confidence, should not detect arm raised."""
        kp = _make_keypoints({
            LEFT_SHOULDER: (100, 200, 0.1),
            LEFT_WRIST: (100, 50, 0.1),
        })
        assert detect_arm_raised(kp) is False