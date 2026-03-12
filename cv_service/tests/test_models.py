# test_models.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import (
    ShotType, Side, Zone, Outcome, ShotPlayer, JobStatus,
    Point2D, CourtCalibration, AnalyzeRequest, ShotResult,
    RallyResult, AnalysisOutput, JobInfo,
    PlayerBox, ShuttlePosition, Keypoints, HitEvent, FrameData,
)


class TestEnums:
    def test_shot_type_values(self):
        expected = {"serve", "clear", "smash", "drop", "drive", "lift", "net", "block"}
        assert {e.value for e in ShotType} == expected

    def test_zone_has_9_values(self):
        assert len(Zone) == 9

    def test_side_values(self):
        assert {e.value for e in Side} == {"me", "opponent"}

    def test_outcome_values(self):
        assert {e.value for e in Outcome} == {"winner", "error", "neither"}

    def test_shot_player_values(self):
        assert {e.value for e in ShotPlayer} == {"me", "partner", "opponent"}

    def test_job_status_values(self):
        assert {e.value for e in JobStatus} == {"queued", "running", "completed", "failed"}


class TestModels:
    def test_point2d_roundtrip(self):
        p = Point2D(x=1.5, y=2.5)
        data = p.model_dump_json()
        p2 = Point2D.model_validate_json(data)
        assert p2.x == 1.5 and p2.y == 2.5

    def test_court_calibration_defaults(self):
        cal = CourtCalibration(
            top_left=Point2D(x=0, y=0),
            top_right=Point2D(x=100, y=0),
            bottom_right=Point2D(x=100, y=200),
            bottom_left=Point2D(x=0, y=200),
        )
        assert cal.near_side == Side.me

    def test_analyze_request_minimal(self):
        req = AnalyzeRequest(video_path="/tmp/test.mp4", match_id=1)
        assert req.calibration is None
        assert req.fps_override is None

    def test_shot_result_json_roundtrip(self):
        shot = ShotResult(
            shot_type=ShotType.smash,
            player=ShotPlayer.me,
            zone_from_side=Side.me,
            zone_from=Zone.center_back,
            zone_to_side=Side.opponent,
            zone_to=Zone.center_front,
            outcome=Outcome.winner,
            timestamp=12.5,
        )
        data = shot.model_dump_json()
        shot2 = ShotResult.model_validate_json(data)
        assert shot2.shot_type == ShotType.smash
        assert shot2.timestamp == 12.5

    def test_analysis_output_empty(self):
        out = AnalysisOutput(rallies=[], rally_count=0, shot_count=0)
        assert out.rallies == []

    def test_job_info_full_lifecycle(self):
        info = JobInfo(job_id="abc123", status=JobStatus.queued)
        assert info.progress is None
        assert info.result is None

    def test_frame_data_defaults(self):
        fd = FrameData(frame_idx=0, timestamp=0.0)
        assert fd.players == []
        assert fd.shuttle is None
        assert fd.keypoints == []

    def test_player_box_with_court_pos(self):
        pb = PlayerBox(
            track_id=1,
            bbox=(10.0, 20.0, 50.0, 100.0),
            center=Point2D(x=30.0, y=60.0),
            court_pos=Point2D(x=3.0, y=6.0),
            side=Side.me,
        )
        assert pb.side == Side.me

    def test_hit_event_minimal(self):
        he = HitEvent(frame_idx=100, timestamp=3.33)
        assert he.player_track_id is None
        assert he.shuttle_px is None