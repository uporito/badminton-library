# test_api.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from config import settings
from main import app


@pytest.fixture(autouse=True)
def tmp_jobs_dir():
    """Redirect job storage to temp directory."""
    orig = settings.jobs_dir
    with tempfile.TemporaryDirectory() as d:
        settings.jobs_dir = Path(d)
        yield
        settings.jobs_dir = orig


class TestHealthEndpoint:
    def test_returns_ok(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "shuttle_tracking" in data
        assert isinstance(data["shuttle_tracking"], bool)


class TestAnalyzeEndpoint:
    def test_returns_job_id(self):
        client = TestClient(app)
        # Patch run_pipeline to avoid actually processing
        with patch("main.run_pipeline") as mock_pipeline:
            mock_pipeline.return_value = MagicMock(rally_count=0, shot_count=0)
            resp = client.post("/analyze", json={
                "video_path": "/fake/path.mp4",
                "match_id": 1,
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "job_id" in data
        assert data["status"] in ("queued", "running")

    def test_validation_error(self):
        client = TestClient(app)
        resp = client.post("/analyze", json={"bad": "data"})
        assert resp.status_code == 422  # Pydantic validation

    def test_with_calibration(self):
        client = TestClient(app)
        with patch("main.run_pipeline") as mock_pipeline:
            mock_pipeline.return_value = MagicMock(rally_count=0, shot_count=0)
            resp = client.post("/analyze", json={
                "video_path": "/fake/path.mp4",
                "match_id": 1,
                "calibration": {
                    "top_left": {"x": 0, "y": 0},
                    "top_right": {"x": 100, "y": 0},
                    "bottom_right": {"x": 100, "y": 200},
                    "bottom_left": {"x": 0, "y": 200},
                    "near_side": "me",
                },
            })
        assert resp.status_code == 200


class TestJobsEndpoint:
    def test_nonexistent_job_404(self):
        client = TestClient(app)
        resp = client.get("/jobs/nonexistent")
        assert resp.status_code == 404

    def test_created_job_retrievable(self):
        client = TestClient(app)
        with patch("main.run_pipeline") as mock_pipeline:
            mock_pipeline.return_value = MagicMock(rally_count=0, shot_count=0)
            create_resp = client.post("/analyze", json={
                "video_path": "/fake/path.mp4",
                "match_id": 1,
            })
        job_id = create_resp.json()["job_id"]

        resp = client.get(f"/jobs/{job_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == job_id
        assert data["status"] in ("queued", "running", "completed")