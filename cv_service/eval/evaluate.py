"""
Usage:
    python eval/evaluate.py \
        --ground-truth eval/ground_truth/ \
        --predictions eval/predictions/ \
        --output eval/results/run_XYZ.json
"""

import json
import argparse
from pathlib import Path
from collections import Counter


def match_rallies(gt_rallies, pred_rallies, tolerance_sec=2.0):
    """Match ground-truth rallies to predicted rallies by time overlap."""
    matches = []
    used_pred = set()
    for gt in gt_rallies:
        best_match = None
        best_overlap = 0
        for i, pred in enumerate(pred_rallies):
            if i in used_pred:
                continue
            overlap_start = max(gt["start_sec"], pred["start_sec"])
            overlap_end = min(gt["end_sec"], pred["end_sec"])
            overlap = max(0, overlap_end - overlap_start)
            gt_duration = gt["end_sec"] - gt["start_sec"]
            if overlap > 0.5 * gt_duration and overlap > best_overlap:
                best_overlap = overlap
                best_match = i
        if best_match is not None:
            matches.append((gt, pred_rallies[best_match]))
            used_pred.add(best_match)
        else:
            matches.append((gt, None))
    return matches


def match_shots(gt_shots, pred_shots, tolerance_sec=0.5):
    """Match ground-truth shots to predicted shots by timestamp proximity."""
    matches = []
    used_pred = set()
    for gt_shot in gt_shots:
        best_idx = None
        best_delta = float("inf")
        for i, pred_shot in enumerate(pred_shots):
            if i in used_pred:
                continue
            delta = abs(gt_shot["timestamp"] - pred_shot["timestamp"])
            if delta < tolerance_sec and delta < best_delta:
                best_delta = delta
                best_idx = i
        if best_idx is not None:
            matches.append((gt_shot, pred_shots[best_idx]))
            used_pred.add(best_idx)
        else:
            matches.append((gt_shot, None))
    return matches


def compute_metrics(gt_path, pred_path):
    """Compute all metrics for one clip."""
    gt = json.loads(Path(gt_path).read_text())
    pred = json.loads(Path(pred_path).read_text())

    gt_rallies = gt["rallies"]
    pred_rallies = pred.get("rallies", [])

    # Rally-level metrics
    rally_matches = match_rallies(gt_rallies, pred_rallies)
    rally_recall = sum(1 for _, p in rally_matches if p is not None) / max(len(gt_rallies), 1)
    rally_precision = sum(1 for _, p in rally_matches if p is not None) / max(len(pred_rallies), 1)
    rally_f1 = (2 * rally_precision * rally_recall / max(rally_precision + rally_recall, 1e-9))

    rally_count_err = abs(len(pred_rallies) - len(gt_rallies)) / max(len(gt_rallies), 1)

    # Shot-level metrics (within matched rallies)
    total_shots_matched = 0
    shot_type_correct = 0
    shot_type_counts = Counter()

    for gt_rally, pred_rally in rally_matches:
        if pred_rally is None:
            continue
        gt_shots = gt_rally.get("shots", [])
        pred_shots = pred_rally.get("shots", [])
        shot_matches = match_shots(gt_shots, pred_shots)

        for gt_shot, pred_shot in shot_matches:
            if pred_shot is not None:
                total_shots_matched += 1
                gt_type = gt_shot["shot_type"]
                pred_type = pred_shot["shot_type"]
                shot_type_counts[(gt_type, pred_type)] += 1
                if gt_type == pred_type:
                    shot_type_correct += 1

    shot_type_acc = shot_type_correct / max(total_shots_matched, 1)

    return {
        "rally_count_gt": len(gt_rallies),
        "rally_count_pred": len(pred_rallies),
        "rally_count_error": rally_count_err,
        "rally_precision": rally_precision,
        "rally_recall": rally_recall,
        "rally_f1": rally_f1,
        "shots_matched": total_shots_matched,
        "shot_type_accuracy": shot_type_acc,
        "shot_type_confusion": dict(
            (f"{gt}->{pred}", count) for (gt, pred), count in shot_type_counts.items()
        ),
    }