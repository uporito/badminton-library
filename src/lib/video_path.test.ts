import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { resolveVideoPath, getMimeType } from "./video_path";

describe("resolveVideoPath", () => {
  let tmpDir: string;
  let videoRoot: string;
  let subDir: string;
  let savedVideoRoot: string | undefined;

  beforeEach(() => {
    savedVideoRoot = process.env.VIDEO_ROOT;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-path-test-"));
    videoRoot = path.join(tmpDir, "videos");
    subDir = path.join(videoRoot, "sub");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(videoRoot, "a.mp4"), "x");
    fs.writeFileSync(path.join(subDir, "b.mp4"), "y");
  });

  afterEach(() => {
    process.env.VIDEO_ROOT = savedVideoRoot;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns ROOT_NOT_SET when VIDEO_ROOT is unset", () => {
    delete process.env.VIDEO_ROOT;
    expect(resolveVideoPath("a.mp4")).toEqual({ ok: false, error: "ROOT_NOT_SET" });
  });

  it("returns ROOT_NOT_SET when VIDEO_ROOT is empty", () => {
    process.env.VIDEO_ROOT = "   ";
    expect(resolveVideoPath("a.mp4")).toEqual({ ok: false, error: "ROOT_NOT_SET" });
  });

  it("resolves a relative path under root", () => {
    process.env.VIDEO_ROOT = videoRoot;
    const result = resolveVideoPath("a.mp4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fullPath).toBe(path.join(videoRoot, "a.mp4"));
    }
  });

  it("resolves a nested relative path", () => {
    process.env.VIDEO_ROOT = videoRoot;
    const result = resolveVideoPath("sub/b.mp4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fullPath).toBe(path.join(videoRoot, "sub", "b.mp4"));
    }
  });

  it("returns PATH_INVALID for path traversal", () => {
    process.env.VIDEO_ROOT = videoRoot;
    expect(resolveVideoPath("../other/file.mp4")).toEqual({
      ok: false,
      error: "PATH_INVALID",
    });
    expect(resolveVideoPath("sub/../../etc/passwd")).toEqual({
      ok: false,
      error: "PATH_INVALID",
    });
  });

  it("returns NOT_FOUND when file does not exist", () => {
    process.env.VIDEO_ROOT = videoRoot;
    expect(resolveVideoPath("nonexistent.mp4")).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  });
});

describe("getMimeType", () => {
  it("returns video/mp4 for .mp4", () => {
    expect(getMimeType("/foo/bar.mp4")).toBe("video/mp4");
  });

  it("returns video/webm for .webm", () => {
    expect(getMimeType("x.webm")).toBe("video/webm");
  });

  it("returns application/octet-stream for unknown ext", () => {
    expect(getMimeType("file.xyz")).toBe("application/octet-stream");
  });
});
