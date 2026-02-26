"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddMatchForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [videoPath, setVideoPath] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          videoPath: videoPath.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? data.details?.title?.[0] ?? `Error ${res.status}`);
        return;
      }
      setStatus("success");
      setMessage("Match added. Refreshing…");
      setTitle("");
      setVideoPath("");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Request failed");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Add match
      </h2>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Video path is relative to VIDEO_ROOT (e.g. <code>my_video.mp4</code>).
        Title is optional; if empty, the filename is used.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My match (optional)"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Video path
          </span>
          <input
            type="text"
            value={videoPath}
            onChange={(e) => setVideoPath(e.target.value)}
            placeholder="e.g. my_video.mp4"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={status === "loading" || !videoPath.trim()}
          className="rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {status === "loading" ? "Adding…" : "Add"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-sm ${
            status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
