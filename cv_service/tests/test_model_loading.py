# test_model_loading.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest


def _synthetic_frame(h=480, w=640):
    """Create a synthetic BGR frame with simple shapes."""
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    import cv2
    # Draw a person-like rectangle
    cv2.rectangle(frame, (280, 100), (360, 400), (200, 200, 200), -1)
    # Head
    cv2.circle(frame, (320, 80), 30, (200, 200, 200), -1)
    return frame


class TestYoloDetectionModel:
    def test_loads_without_error(self):
        from stages.player_detection import _get_model
        model = _get_model()
        assert model is not None

    def test_inference_returns_results(self):
        from stages.player_detection import detect_players_in_frame, reset_tracker
        reset_tracker()
        frame = _synthetic_frame()
        players = detect_players_in_frame(frame, homography=None, persist=False)
        # We don't assert specific detections on a synthetic frame,
        # just that the function returns a valid list
        assert isinstance(players, list)

    def test_output_structure(self):
        from stages.player_detection import detect_players_in_frame, reset_tracker
        from models import PlayerBox
        reset_tracker()
        frame = _synthetic_frame()
        players = detect_players_in_frame(frame, homography=None, persist=False)
        for p in players:
            assert isinstance(p, PlayerBox)
            assert len(p.bbox) == 4
            assert p.center.x >= 0
            assert p.center.y >= 0


class TestYoloPoseModel:
    def test_loads_without_error(self):
        from stages.pose_estimation import _get_model
        model = _get_model()
        assert model is not None

    def test_inference_returns_keypoints(self):
        from stages.pose_estimation import estimate_poses
        from models import Keypoints
        frame = _synthetic_frame()
        kps = estimate_poses(frame)
        assert isinstance(kps, list)
        for kp in kps:
            assert isinstance(kp, Keypoints)
            assert len(kp.data) == 51  # 17 keypoints * 3 values


class TestTrackNetAvailability:
    def test_is_available_returns_bool(self):
        from stages.shuttle_tracking import is_available
        result = is_available()
        assert isinstance(result, bool)

    @pytest.mark.skipif(
        not __import__("stages.shuttle_tracking", fromlist=["is_available"]).is_available(),
        reason="TrackNetV3 not installed",
    )
    def test_shuttle_detection_runs(self):
        from stages.shuttle_tracking import detect_shuttle
        frames = [_synthetic_frame() for _ in range(3)]
        results = detect_shuttle(frames)
        assert isinstance(results, list)
        assert len(results) == 3


class TestSceneDetectImport:
    def test_scenedetect_imports(self):
        from scenedetect import detect, ContentDetector
        assert detect is not None
        assert ContentDetector is not None