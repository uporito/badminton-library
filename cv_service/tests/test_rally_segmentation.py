# test_rally_segmentation.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import HitEvent, Side
from stages.rally_segmentation import segment_rallies, _determine_rally_winner
from models import ShotResult, ShotType, ShotPlayer, Zone, Outcome


def _hit(frame, ts, side=None):
    return HitEvent(frame_idx=frame, timestamp=ts, player_side=side)


class TestSegmentRallies:
    def test_empty_hits(self):
        assert segment_rallies([], {}, None) == []

    def test_single_hit_discarded(self):
        """Single-hit 'rallies' should be filtered as false positives."""
        hits = [_hit(0, 0.0)]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 0

    def test_continuous_hits_one_rally(self):
        """Hits within gap threshold form a single rally."""
        hits = [_hit(i * 30, i * 1.0) for i in range(10)]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 1
        assert len(rallies[0]) == 10

    def test_gap_splits_rallies(self):
        """A gap > threshold should split into two rallies."""
        hits = [
            _hit(0, 0.0), _hit(30, 1.0), _hit(60, 2.0),
            # 5-second gap
            _hit(210, 7.0), _hit(240, 8.0), _hit(270, 9.0),
        ]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 2
        assert len(rallies[0]) == 3
        assert len(rallies[1]) == 3

    def test_multiple_gaps(self):
        """Multiple gaps should produce multiple rallies."""
        hits = [
            _hit(0, 0.0), _hit(30, 1.0),  # rally 1
            _hit(200, 7.0), _hit(230, 8.0),  # rally 2
            _hit(400, 14.0), _hit(430, 15.0),  # rally 3
        ]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 3

    def test_single_hit_island_filtered(self):
        """A lone hit between two rallies should be discarded."""
        hits = [
            _hit(0, 0.0), _hit(30, 1.0),  # rally (2 hits)
            _hit(200, 7.0),  # lone hit
            _hit(400, 14.0), _hit(430, 15.0),  # rally (2 hits)
        ]
        rallies = segment_rallies(hits, {}, None, gap_seconds=3.0)
        assert len(rallies) == 2


class TestDetermineRallyWinner:
    def _shot(self, outcome, player):
        return ShotResult(
            shot_type=ShotType.clear,
            player=ShotPlayer(player),
            zone_from_side=Side.me, zone_from=Zone.center_mid,
            zone_to_side=Side.opponent, zone_to=Zone.center_mid,
            outcome=Outcome(outcome),
            timestamp=0.0,
        )

    def test_winner_by_me(self):
        shots = [self._shot("neither", "me"), self._shot("winner", "me")]
        assert _determine_rally_winner(shots) is True

    def test_winner_by_opponent(self):
        shots = [self._shot("neither", "me"), self._shot("winner", "opponent")]
        assert _determine_rally_winner(shots) is False

    def test_error_by_opponent_wins_for_me(self):
        shots = [self._shot("neither", "me"), self._shot("error", "opponent")]
        assert _determine_rally_winner(shots) is True

    def test_error_by_me_loses(self):
        shots = [self._shot("neither", "opponent"), self._shot("error", "me")]
        assert _determine_rally_winner(shots) is False

    def test_empty_shots(self):
        assert _determine_rally_winner([]) is False