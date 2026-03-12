# test_scene_cut.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from pathlib import Path
from stages.scene_cut import detect_scene_cuts, merge_gameplay_segments, VideoSegment

FIXTURES = Path(__file__).parent / "fixtures"
TEST_VIDEO = FIXTURES / "test_video.mp4"


@pytest.mark.skipif(not TEST_VIDEO.exists(), reason="Test video not found")
class TestSceneCutDetection:
    def test_returns_segments(self):
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        assert isinstance(segments, list)
        assert len(segments) >= 1

    def test_segment_structure(self):
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        for seg in segments:
            assert isinstance(seg, VideoSegment)
            assert seg.start_frame >= 0
            assert seg.end_frame >= seg.start_frame
            assert seg.start_sec >= 0
            assert seg.end_sec >= seg.start_sec

    def test_covers_full_video(self):
        """Segments should collectively cover the video timeline."""
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        assert segments[0].start_frame == 0
        assert segments[-1].end_frame >= 100

    def test_synthetic_no_cuts(self):
        """A uniform synthetic video should produce a single segment."""
        segments = detect_scene_cuts(str(TEST_VIDEO), fps=30.0, total_frames=150)
        gameplay = [s for s in segments if s.is_gameplay]
        assert len(gameplay) >= 1


class TestMergeGameplay:
    def test_merges_close_segments(self):
        segs = [
            VideoSegment(0, 100, 0.0, 3.33, True),
            VideoSegment(101, 105, 3.37, 3.5, False),
            VideoSegment(106, 200, 3.53, 6.67, True),
        ]
        merged = merge_gameplay_segments(segs, gap_threshold_sec=1.0)
        assert len(merged) == 1
        assert merged[0].start_frame == 0
        assert merged[0].end_frame == 200

    def test_keeps_distant_segments_separate(self):
        segs = [
            VideoSegment(0, 100, 0.0, 3.33, True),
            VideoSegment(300, 400, 10.0, 13.33, True),
        ]
        merged = merge_gameplay_segments(segs, gap_threshold_sec=1.0)
        assert len(merged) == 2

    def test_empty_input(self):
        assert merge_gameplay_segments([]) == []

    def test_non_gameplay_filtered(self):
        segs = [
            VideoSegment(0, 100, 0.0, 3.33, True),
            VideoSegment(101, 200, 3.37, 6.67, False),
            VideoSegment(201, 300, 6.7, 10.0, True),
        ]
        merged = merge_gameplay_segments(segs, gap_threshold_sec=1.0)
        for seg in merged:
            assert seg.is_gameplay