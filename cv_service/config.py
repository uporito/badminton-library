from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


_SERVICE_ROOT = Path(__file__).resolve().parent


def _default_device() -> str:
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


class Settings(BaseSettings):
    host: str = "127.0.0.1"
    port: int = 8100

    # Compute device for all ML models: "cuda", "cpu", or "cuda:0" etc.
    # Defaults to "cuda" when a CUDA-capable GPU is detected, otherwise "cpu".
    # Override with CV_DEVICE=cpu in .env if you want to force CPU.
    device: str = Field(default_factory=_default_device)

    weights_dir: Path = Field(default=_SERVICE_ROOT / "weights")
    vendor_dir: Path = Field(default=_SERVICE_ROOT / "vendor")
    jobs_dir: Path = Field(default=_SERVICE_ROOT / "jobs")

    tracknet_weights: str = "tracknetv3.pt"

    yolo_detect_model: str = "yolo11n.pt"
    yolo_pose_model: str = "yolo11n-pose.pt"

    scene_cut_threshold: float = 27.0
    scene_cut_min_scene_len_sec: float = 1.0

    shuttle_conf_threshold: float = 0.5
    player_conf_threshold: float = 0.4
    player_iou_threshold: float = 0.5

    hit_angle_change_deg: float = 60.0
    hit_min_gap_frames: int = 5

    rally_gap_seconds: float = 3.0

    # Process every Nth frame (1 = every frame, 2 = every other, etc.)
    # Higher values speed up processing but reduce accuracy.
    frame_skip: int = 1

    # Court dimensions in meters (doubles court)
    court_length: float = 13.4
    court_width: float = 6.1
    half_court_length: float = 6.7

    class Config:
        env_prefix = "CV_"
        env_file = ".env"


settings = Settings()
