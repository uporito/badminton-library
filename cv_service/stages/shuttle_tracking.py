"""Stage 4: Shuttle tracking using TrackNetV3.

Falls back gracefully if TrackNetV3 is not installed. The shuttle tracker
processes consecutive frames and outputs per-frame shuttle positions.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import cv2
import numpy as np

from config import settings
from models import ShuttlePosition, Point2D
from stages.court_detection import Homography

logger = logging.getLogger(__name__)

_tracknet_model = None
_tracknet_available: bool | None = None
_tracknet_load_failed: bool = False

INPUT_HEIGHT = 288
INPUT_WIDTH = 512
N_INPUT_FRAMES = 3


def _check_tracknet_available() -> bool:
    global _tracknet_available
    if _tracknet_available is not None:
        return _tracknet_available

    weights_path = settings.weights_dir / settings.tracknet_weights
    vendor_path = settings.vendor_dir / "TrackNetV3"

    if not weights_path.exists():
        logger.warning(
            "TrackNetV3 weights not found at %s. "
            "Shuttle tracking will be disabled. "
            "Download weights and place them there to enable.",
            weights_path,
        )
        _tracknet_available = False
        return False

    if not vendor_path.exists():
        logger.warning(
            "TrackNetV3 repo not found at %s. "
            "Clone it: cd cv_service/vendor && git clone https://github.com/qaz812345/TrackNetV3.git",
            vendor_path,
        )
        _tracknet_available = False
        return False

    _tracknet_available = True
    return True


def _get_model():
    """Load the TrackNetV3 model. Returns None if unavailable."""
    global _tracknet_model, _tracknet_load_failed
    if _tracknet_model is not None:
        return _tracknet_model
    if _tracknet_load_failed:
        return None

    if not _check_tracknet_available():
        return None

    try:
        import torch

        vendor_path = settings.vendor_dir / "TrackNetV3"
        if str(vendor_path) not in sys.path:
            sys.path.insert(0, str(vendor_path))

        # The cloned repo may expose the model class under different names
        # depending on the fork. Try common variants.
        model_cls = None
        for module_name, class_name in [
            ("TrackNet", "TrackNet"),
            ("model", "TrackNetV2"),
            ("model", "TrackNet"),
        ]:
            try:
                mod = __import__(module_name, fromlist=[class_name])
                model_cls = getattr(mod, class_name)
                logger.info("Found model class %s.%s", module_name, class_name)
                break
            except (ImportError, AttributeError):
                continue

        if model_cls is None:
            raise ImportError(
                f"Cannot find TrackNet model class in {vendor_path}. "
                f"Expected TrackNet.TrackNet or model.TrackNetV2"
            )

        device = torch.device(settings.device)
        model = model_cls(
            in_dim=N_INPUT_FRAMES * 3,
            out_dim=N_INPUT_FRAMES,
        )

        weights_path = settings.weights_dir / settings.tracknet_weights
        checkpoint = torch.load(weights_path, map_location=device, weights_only=False)
        if "model_state_dict" in checkpoint:
            model.load_state_dict(checkpoint["model_state_dict"])
        else:
            model.load_state_dict(checkpoint)

        model.to(device)
        model.eval()
        _tracknet_model = (model, device)
        logger.info("TrackNetV3 loaded on %s", device)
        return _tracknet_model
    except Exception as e:
        logger.error("Failed to load TrackNetV3: %s", e)
        _tracknet_load_failed = True
        return None


def preprocess_frame(frame: np.ndarray) -> np.ndarray:
    """Resize and normalize a frame for TrackNetV3 input."""
    resized = cv2.resize(frame, (INPUT_WIDTH, INPUT_HEIGHT))
    return resized.astype(np.float32) / 255.0


def detect_shuttle(
    frames: list[np.ndarray],
    homography: Homography | None = None,
) -> list[ShuttlePosition | None]:
    """Detect shuttle position in the last frame of a consecutive frame batch.

    Args:
        frames: List of N_INPUT_FRAMES consecutive BGR frames.
        homography: Optional homography for court coordinate mapping.

    Returns:
        List with one entry per input frame. Only the last frame may have a
        detection; earlier frames return None.
    """
    import torch

    result = _get_model()
    if result is None:
        return [None] * len(frames)

    model, device = result

    if len(frames) < N_INPUT_FRAMES:
        return [None] * len(frames)

    processed = [preprocess_frame(f) for f in frames[-N_INPUT_FRAMES:]]
    # Stack frames channel-wise: (H, W, 3*N) then transpose to (3*N, H, W)
    stacked = np.concatenate(processed, axis=2)
    tensor = torch.from_numpy(stacked).permute(2, 0, 1).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(tensor)

    results: list[ShuttlePosition | None] = [None] * len(frames)

    for i in range(N_INPUT_FRAMES):
        heatmap = output[0, i].cpu().numpy()
        if heatmap.max() < settings.shuttle_conf_threshold:
            continue

        y_idx, x_idx = np.unravel_index(heatmap.argmax(), heatmap.shape)
        conf = float(heatmap[y_idx, x_idx])

        orig_h, orig_w = frames[0].shape[:2]
        scale_x = orig_w / INPUT_WIDTH
        scale_y = orig_h / INPUT_HEIGHT
        px_x = float(x_idx) * scale_x
        px_y = float(y_idx) * scale_y

        court_pos = None
        if homography is not None:
            try:
                cx, cy = homography.pixel_to_court(px_x, px_y)
                if 0 <= cx <= homography.court_width and 0 <= cy <= homography.court_length:
                    court_pos = Point2D(x=cx, y=cy)
            except Exception:
                pass

        frame_offset = len(frames) - N_INPUT_FRAMES + i
        results[frame_offset] = ShuttlePosition(
            x=px_x, y=px_y, confidence=conf, court_pos=court_pos,
        )

    return results


def is_available() -> bool:
    """Check if shuttle tracking is available (files exist AND model can load)."""
    if not _check_tracknet_available():
        return False
    if _tracknet_load_failed:
        return False
    return _get_model() is not None
