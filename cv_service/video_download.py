"""Utility for downloading a remote video to a local temp file before CV processing."""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import Callable
from urllib.request import Request, urlopen
from urllib.error import URLError

from config import settings

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, float], None]

_CHUNK_SIZE = 1024 * 1024  # 1 MB


def get_tmp_dir() -> Path:
    tmp = settings.jobs_dir / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    return tmp


def download_video(
    url: str,
    auth_header: str | None,
    *,
    on_progress: ProgressCallback | None = None,
    start_pct: float = 0.0,
    end_pct: float = 0.10,
) -> str:
    """Download a video from *url* to a temp file and return the local path.

    Progress is reported in the range [start_pct, end_pct] using on_progress.
    The caller is responsible for deleting the returned file when done.
    """
    progress = on_progress or (lambda msg, pct: None)

    headers: dict[str, str] = {}
    if auth_header:
        headers["Authorization"] = auth_header

    req = Request(url, headers=headers)

    try:
        response = urlopen(req, timeout=60)
    except URLError as e:
        raise RuntimeError(f"Failed to connect to video URL: {e}") from e

    content_length_header = response.headers.get("Content-Length")
    total_bytes = int(content_length_header) if content_length_header else None

    suffix = _guess_extension(response.headers.get("Content-Type", ""))
    dest = get_tmp_dir() / f"{uuid.uuid4().hex}{suffix}"

    progress(
        f"Downloading video{f' ({total_bytes // 1024 // 1024} MB)' if total_bytes else ''}...",
        start_pct,
    )

    downloaded = 0
    try:
        with open(dest, "wb") as f:
            while True:
                chunk = response.read(_CHUNK_SIZE)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total_bytes:
                    frac = downloaded / total_bytes
                    pct = start_pct + frac * (end_pct - start_pct)
                    mb_done = downloaded // 1024 // 1024
                    mb_total = total_bytes // 1024 // 1024
                    progress(f"Downloading video... {mb_done}/{mb_total} MB", pct)
    except Exception:
        # Clean up partial download
        if dest.exists():
            dest.unlink(missing_ok=True)
        raise

    logger.info("Downloaded %d bytes to %s", downloaded, dest)
    progress("Download complete", end_pct)
    return str(dest)


def cleanup_tmp_dir() -> None:
    """Remove all files in the tmp directory (e.g. on service startup after a crash)."""
    tmp = settings.jobs_dir / "tmp"
    if not tmp.exists():
        return
    removed = 0
    for f in tmp.iterdir():
        if f.is_file():
            try:
                f.unlink()
                removed += 1
            except OSError as e:
                logger.warning("Could not remove stale temp file %s: %s", f, e)
    if removed:
        logger.info("Cleaned up %d stale temp file(s) from %s", removed, tmp)


def _guess_extension(content_type: str) -> str:
    mime_map = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
        "video/ogg": ".ogg",
        "video/x-m4v": ".m4v",
    }
    base = content_type.split(";")[0].strip().lower()
    return mime_map.get(base, ".mp4")
