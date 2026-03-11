"""Simple file-based job store. Each job is a JSON file in the jobs directory."""

from __future__ import annotations

import uuid
from pathlib import Path

from models import JobStatus, JobInfo, AnalysisOutput
from config import settings

_UNSET = object()


def _jobs_dir() -> Path:
    d = settings.jobs_dir
    d.mkdir(parents=True, exist_ok=True)
    return d


def _job_path(job_id: str) -> Path:
    return _jobs_dir() / f"{job_id}.json"


def create_job() -> str:
    job_id = uuid.uuid4().hex[:12]
    info = JobInfo(job_id=job_id, status=JobStatus.queued)
    _job_path(job_id).write_text(info.model_dump_json(indent=2))
    return job_id


def get_job(job_id: str) -> JobInfo | None:
    p = _job_path(job_id)
    if not p.exists():
        return None
    return JobInfo.model_validate_json(p.read_text())


def update_job(
    job_id: str,
    *,
    status: JobStatus | None = None,
    progress: str | None | object = _UNSET,
    progress_pct: float | None | object = _UNSET,
    result: AnalysisOutput | None | object = _UNSET,
    error: str | None | object = _UNSET,
) -> None:
    info = get_job(job_id)
    if info is None:
        return
    if status is not None:
        info.status = status
    if progress is not _UNSET:
        info.progress = progress  # type: ignore[assignment]
    if progress_pct is not _UNSET:
        info.progress_pct = progress_pct  # type: ignore[assignment]
    if result is not _UNSET:
        info.result = result  # type: ignore[assignment]
    if error is not _UNSET:
        info.error = error  # type: ignore[assignment]
    _job_path(job_id).write_text(info.model_dump_json(indent=2))
