"""
Grid search over key thresholds to find the best config.

Usage:
    python eval/grid_search.py \
        --ground-truth-dir eval/ground_truth/ \
        --output eval/results/grid_search.json
"""

import json
import itertools
from pathlib import Path
from config import settings
from models import AnalyzeRequest, CourtCalibration, Point2D, Side
from pipeline import run_pipeline


PARAM_GRID = {
    "hit_angle_change_deg": [40.0, 50.0, 60.0, 70.0, 80.0],
    "rally_gap_seconds": [2.0, 3.0, 4.0, 5.0],
    "shuttle_conf_threshold": [0.3, 0.4, 0.5, 0.6],
    "player_conf_threshold": [0.3, 0.4, 0.5],
    "hit_min_gap_frames": [3, 5, 8],
}


def run_with_config(config, gt_dir):
    """Run pipeline on all ground-truth clips with the given config."""
    for key, value in config.items():
        setattr(settings, key, value)

    gt_files = sorted(Path(gt_dir).glob("*.json"))
    all_metrics = []
    for gt_file in gt_files:
        gt = json.loads(gt_file.read_text())
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
            video_path=gt["video_path"],
            match_id=0,
            calibration=calibration,
        )

        try:
            result = run_pipeline(request, on_progress=lambda m, p: None)
            all_metrics.append({
                "clip": gt_file.stem,
                "rally_count_gt": len(gt["rallies"]),
                "rally_count_pred": result.rally_count,
                "shot_count_pred": result.shot_count,
            })
        except Exception as e:
            all_metrics.append({"clip": gt_file.stem, "error": str(e)})

    return all_metrics


def grid_search(gt_dir, output_path):
    keys = list(PARAM_GRID.keys())
    values = list(PARAM_GRID.values())
    results = []

    for combo in itertools.product(*values):
        config = dict(zip(keys, combo))
        print(f"Testing: {config}")
        metrics = run_with_config(config, gt_dir)
        results.append({"config": config, "metrics": metrics})

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(results, indent=2))
    print(f"Grid search complete. {len(results)} configs tested.")
    print(f"Results saved to {output_path}")