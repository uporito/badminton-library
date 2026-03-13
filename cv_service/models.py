"""Pydantic models shared across the CV service."""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, model_validator


# ── Enums (mirror the Next.js schema) ────────────────────────────────────────

class ShotType(str, Enum):
    serve = "serve"
    clear = "clear"
    smash = "smash"
    drop = "drop"
    drive = "drive"
    lift = "lift"
    net = "net"
    block = "block"


class Side(str, Enum):
    me = "me"
    opponent = "opponent"


class Zone(str, Enum):
    left_front = "left_front"
    left_mid = "left_mid"
    left_back = "left_back"
    center_front = "center_front"
    center_mid = "center_mid"
    center_back = "center_back"
    right_front = "right_front"
    right_mid = "right_mid"
    right_back = "right_back"


class Outcome(str, Enum):
    winner = "winner"
    error = "error"
    neither = "neither"


class ShotPlayer(str, Enum):
    me = "me"
    partner = "partner"
    opponent = "opponent"


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


# ── Request / Response models ─────────────────────────────────────────────────

class Point2D(BaseModel):
    x: float
    y: float


class CourtCalibration(BaseModel):
    """Four court corners in pixel coordinates (order: TL, TR, BR, BL as seen
    from the camera, i.e. the far-left, far-right, near-right, near-left
    corners of the full court)."""
    top_left: Point2D
    top_right: Point2D
    bottom_right: Point2D
    bottom_left: Point2D
    near_side: Side = Field(
        default=Side.me,
        description="Which player is on the near (bottom) side of the frame",
    )


class AnalyzeRequest(BaseModel):
    video_path: Optional[str] = None
    video_url: Optional[str] = None
    auth_header: Optional[str] = None
    match_id: int
    calibration: Optional[CourtCalibration] = None
    fps_override: Optional[float] = None

    @model_validator(mode="after")
    def check_video_source(self) -> "AnalyzeRequest":
        has_path = bool(self.video_path)
        has_url = bool(self.video_url)
        if has_path == has_url:
            raise ValueError("Exactly one of video_path or video_url must be provided")
        return self


class ShotResult(BaseModel):
    shot_type: ShotType
    player: ShotPlayer
    zone_from_side: Side
    zone_from: Zone
    zone_to_side: Side
    zone_to: Zone
    outcome: Outcome
    timestamp: float


class RallyResult(BaseModel):
    won_by_me: bool
    shots: list[ShotResult]


class AnalysisOutput(BaseModel):
    rallies: list[RallyResult]
    rally_count: int = 0
    shot_count: int = 0


class JobInfo(BaseModel):
    job_id: str
    status: JobStatus
    progress: Optional[str] = None
    progress_pct: Optional[float] = None
    result: Optional[AnalysisOutput] = None
    error: Optional[str] = None


# ── Internal intermediate data ────────────────────────────────────────────────

class PlayerBox(BaseModel):
    track_id: int
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2
    center: Point2D
    court_pos: Optional[Point2D] = None
    side: Optional[Side] = None


class ShuttlePosition(BaseModel):
    x: float
    y: float
    confidence: float = 1.0
    court_pos: Optional[Point2D] = None


class Keypoints(BaseModel):
    """17 COCO keypoints as flat list of (x, y, confidence) triples."""
    data: list[float]
    track_id: int


class HitEvent(BaseModel):
    frame_idx: int
    timestamp: float
    player_track_id: Optional[int] = None
    player_side: Optional[Side] = None
    shuttle_px: Optional[Point2D] = None
    shuttle_court: Optional[Point2D] = None


class FrameData(BaseModel):
    """All detections for a single frame."""
    frame_idx: int
    timestamp: float
    players: list[PlayerBox] = Field(default_factory=list)
    shuttle: Optional[ShuttlePosition] = None
    keypoints: list[Keypoints] = Field(default_factory=list)
