# test_job_store.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile
from pathlib import Path
from unittest.mock import patch
from config import settings
from models import JobStatus, AnalysisOutput
from job_store import create_job, get_job, update_job


class TestJobStore:
    def setup_method(self):
        """Use a temp directory for each test to avoid cross-contamination."""
        self._tmpdir = tempfile.mkdtemp()
        self._orig = settings.jobs_dir
        settings.jobs_dir = Path(self._tmpdir)

    def teardown_method(self):
        settings.jobs_dir = self._orig

    def test_create_job_returns_id(self):
        job_id = create_job()
        assert isinstance(job_id, str)
        assert len(job_id) == 12

    def test_create_job_writes_file(self):
        job_id = create_job()
        p = Path(self._tmpdir) / f"{job_id}.json"
        assert p.exists()

    def test_get_job_returns_queued(self):
        job_id = create_job()
        info = get_job(job_id)
        assert info is not None
        assert info.status == JobStatus.queued
        assert info.job_id == job_id

    def test_get_nonexistent_returns_none(self):
        assert get_job("nonexistent") is None

    def test_update_status(self):
        job_id = create_job()
        update_job(job_id, status=JobStatus.running)
        info = get_job(job_id)
        assert info.status == JobStatus.running

    def test_update_progress(self):
        job_id = create_job()
        update_job(job_id, progress="Stage 1...", progress_pct=0.25)
        info = get_job(job_id)
        assert info.progress == "Stage 1..."
        assert info.progress_pct == 0.25

    def test_update_preserves_unset_fields(self):
        job_id = create_job()
        update_job(job_id, status=JobStatus.running, progress="Starting")
        update_job(job_id, progress_pct=0.5)
        info = get_job(job_id)
        assert info.status == JobStatus.running
        assert info.progress == "Starting"
        assert info.progress_pct == 0.5

    def test_update_with_result(self):
        job_id = create_job()
        result = AnalysisOutput(rallies=[], rally_count=0, shot_count=0)
        update_job(job_id, status=JobStatus.completed, result=result)
        info = get_job(job_id)
        assert info.status == JobStatus.completed
        assert info.result is not None
        assert info.result.rally_count == 0

    def test_update_with_error(self):
        job_id = create_job()
        update_job(job_id, status=JobStatus.failed, error="Boom")
        info = get_job(job_id)
        assert info.status == JobStatus.failed
        assert info.error == "Boom"

    def test_update_nonexistent_is_noop(self):
        update_job("ghost", status=JobStatus.running)  # should not raise