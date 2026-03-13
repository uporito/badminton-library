"""
Run the pipeline on a clip and save predictions in the ground-truth format.

Usage:
    python eval/run_eval.py \
        --video path/to/clip.mp4 \
        --ground-truth eval/ground_truth/clip_001.json \
        --output eval/predictions/clip_001.json
"""

import json
import argparse
from pathlib import Path
from models import AnalyzeRequest, CourtCalibration, Point2D, Side
from pipeline import run_pipeline


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--ground-truth", required=True,
                        help="Ground truth JSON (used to get calibration data)")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    gt = json.loads(Path(args.ground_truth).read_text())
    cal_data = gt.get("calibration")

    calibration = None
    if cal_data:
        calibration = CourtCalibration(
            top_left=Point2D(**cal_data["top_left"]),
            top_right=Point2D(**cal_data["top_right"]),
            bottom_right=Point2D(**cal_data["bottom_right"]),
            bottom_left=Point2D(**cal_data["bottom_left"]),
            near_side=Side(cal_data.get("near_side", "me")),
        )

    request = AnalyzeRequest(
        video_path=args.video,
        match_id=0,
        calibration=calibration,
    )

    def progress(msg, pct):
        print(f"  [{pct:.0%}] {msg}")

    result = run_pipeline(request, on_progress=progress)

    output = {
        "video_path": args.video,
        "rallies": []
    }
    for rally in result.rallies:
        rally_out = {
            "start_sec": rally.shots[0].timestamp if rally.shots else 0,
            "end_sec": rally.shots[-1].timestamp if rally.shots else 0,
            "won_by_me": rally.won_by_me,
            "shots": [
                {
                    "timestamp": s.timestamp,
                    "shot_type": s.shot_type.value,
                    "player": s.player.value,
                    "zone_from": s.zone_from.value,
                    "zone_to": s.zone_to.value,
                    "outcome": s.outcome.value,
                }
                for s in rally.shots
            ]
        }
        output["rallies"].append(rally_out)

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(output, indent=2))
    print(f"\nSaved predictions to {args.output}")
    print(f"  {result.rally_count} rallies, {result.shot_count} shots")


if __name__ == "__main__":
    main()