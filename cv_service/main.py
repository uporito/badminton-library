"""FastAPI CV analysis microservice for badminton video analysis."""

from __future__ import annotations

import logging
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from models import AnalyzeRequest, JobInfo, JobStatus
from job_store import create_job, get_job, update_job
from pipeline import run_pipeline
from video_download import cleanup_tmp_dir

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Badminton CV Analysis Service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _run_job(job_id: str, request: AnalyzeRequest) -> None:
    """Background worker that runs the pipeline and updates job status."""
    try:
        update_job(job_id, status=JobStatus.running, progress="Starting pipeline...")

        def on_progress(msg: str, pct: float) -> None:
            update_job(job_id, progress=msg, progress_pct=pct)

        result = run_pipeline(request, on_progress=on_progress)

        update_job(
            job_id,
            status=JobStatus.completed,
            progress="Complete",
            progress_pct=1.0,
            result=result,
        )
        logger.info("Job %s completed: %d rallies, %d shots", job_id, result.rally_count, result.shot_count)

    except Exception as e:
        logger.exception("Job %s failed", job_id)
        update_job(
            job_id,
            status=JobStatus.failed,
            progress=None,
            error=str(e),
        )


@app.get("/health")
async def health():
    from stages.shuttle_tracking import is_available
    return {
        "status": "ok",
        "shuttle_tracking": is_available(),
    }


@app.post("/analyze", response_model=JobInfo)
async def start_analysis(request: AnalyzeRequest):
    """Start a video analysis job. Returns immediately with a job ID."""
    job_id = create_job()
    video_label = request.video_path or request.video_url or "unknown"
    logger.info("Created job %s for match %d, video: %s", job_id, request.match_id, video_label)

    thread = threading.Thread(
        target=_run_job,
        args=(job_id, request),
        daemon=True,
    )
    thread.start()

    return get_job(job_id)


@app.get("/jobs/{job_id}", response_model=JobInfo)
async def get_job_status(job_id: str):
    """Check the status of an analysis job."""
    info = get_job(job_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return info


@app.on_event("startup")
async def _startup() -> None:
    settings.jobs_dir.mkdir(parents=True, exist_ok=True)
    cleanup_tmp_dir()


if __name__ == "__main__":
    import uvicorn

    settings.jobs_dir.mkdir(parents=True, exist_ok=True)
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )
