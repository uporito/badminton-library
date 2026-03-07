"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MatchRow } from "@/lib/get_match_by_id";
import { matchCategoryEnum, type VideoSource } from "@/db/schema";
import { GDrivePicker } from "./gdrive_picker";
import { HardDrive, GoogleDriveLogo } from "@phosphor-icons/react";

const CATEGORY_OPTIONS = matchCategoryEnum;

export interface MatchFormProps {
  mode: "create" | "edit";
  initialMatch?: MatchRow;
  onSuccess?: () => void;
}

function emptyValues(): Record<string, string | number | ""> {
  return {
    title: "",
    videoPath: "",
    videoSource: "local",
    durationSeconds: "",
    date: "",
    opponent: "",
    result: "",
    notes: "",
    category: "Uncategorized",
  };
}

function matchToValues(m: MatchRow): Record<string, string | number | ""> {
  return {
    title: m.title ?? "",
    videoPath: m.videoPath ?? "",
    videoSource: m.videoSource ?? "local",
    durationSeconds: m.durationSeconds ?? "",
    date: m.date ?? "",
    opponent: m.opponent ?? "",
    result: m.result ?? "",
    notes: m.notes ?? "",
    category: m.category ?? "Uncategorized",
  };
}

export function MatchForm({
  mode,
  initialMatch,
  onSuccess,
}: MatchFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | number | "">>(
    mode === "edit" && initialMatch ? matchToValues(initialMatch) : emptyValues()
  );
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [showGDrivePicker, setShowGDrivePicker] = useState(false);
  const [gdriveAvailable, setGdriveAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/gdrive/status")
      .then((r) => r.json())
      .then((d) => setGdriveAvailable(d.configured === true))
      .catch(() => setGdriveAvailable(false));
  }, []);

  const videoSource = String(values.videoSource) as VideoSource;

  function setValue(name: string, value: string | number) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function switchVideoSource(source: VideoSource) {
    setValues((prev) => ({ ...prev, videoSource: source, videoPath: "" }));
    setShowGDrivePicker(false);
  }

  function handleGDriveSelect(fileId: string, fileName: string) {
    setValues((prev) => ({
      ...prev,
      videoSource: "gdrive",
      videoPath: fileId,
      title: prev.title || fileName.replace(/\.[^.]+$/, ""),
    }));
    setShowGDrivePicker(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const body = {
      title: String(values.title).trim() || undefined,
      videoPath: String(values.videoPath).trim(),
      videoSource: String(values.videoSource) as VideoSource,
      durationSeconds:
        values.durationSeconds === ""
          ? undefined
          : Number(values.durationSeconds),
      date: String(values.date).trim() || undefined,
      opponent: String(values.opponent).trim() || undefined,
      result: String(values.result).trim() || undefined,
      notes: String(values.notes).trim() || undefined,
      category: String(values.category),
    };

    try {
      if (mode === "create") {
        const res = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("error");
          setMessage(
            data.error ?? data.details?.title?.[0] ?? `Error ${res.status}`
          );
          return;
        }
        setStatus("success");
        setMessage("Match added. Refreshing…");
        setValues(emptyValues());
      } else {
        if (!initialMatch) return;
        const res = await fetch(`/api/matches/${initialMatch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("error");
          setMessage(
            data.error ?? data.details?.title?.[0] ?? `Error ${res.status}`
          );
          return;
        }
        setStatus("success");
        setMessage("Match updated. Refreshing…");
      }
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Request failed");
    }
  }

  const inputClass =
    "rounded border border-ui-elevated-more bg-ui-elevated px-3 py-2 text-sm text-foreground";

  const selectedGDriveFileName = videoSource === "gdrive" && values.videoPath
    ? String(values.videoPath)
    : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="frame flex flex-col gap-3 rounded-xl p-4"
    >
      <h2 className="text-sm font-semibold text-text-main">
        {mode === "create" ? "Add match" : "Edit match"}
      </h2>

      {/* Video source tabs */}
      {gdriveAvailable && (
        <div className="flex gap-1 rounded-lg bg-ui-elevated p-0.5">
          <button
            type="button"
            onClick={() => switchVideoSource("local")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              videoSource === "local"
                ? "bg-ui-elevated-more text-text-main shadow-sm"
                : "text-text-soft hover:text-text-main"
            }`}
          >
            <HardDrive size={14} />
            Local file
          </button>
          <button
            type="button"
            onClick={() => switchVideoSource("gdrive")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              videoSource === "gdrive"
                ? "bg-ui-elevated-more text-text-main shadow-sm"
                : "text-text-soft hover:text-text-main"
            }`}
          >
            <GoogleDriveLogo size={14} />
            Google Drive
          </button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-soft">
            Title (required)
          </span>
          <input
            type="text"
            value={values.title}
            onChange={(e) => setValue("title", e.target.value)}
            required
            className={inputClass}
            placeholder="e.g. My match"
          />
        </label>

        {videoSource === "local" ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-soft">
              Video path (required)
            </span>
            <input
              type="text"
              value={values.videoPath}
              onChange={(e) => setValue("videoPath", e.target.value)}
              required
              className={inputClass}
              placeholder="e.g. my_video.mp4"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-soft">
              Google Drive video (required)
            </span>
            {selectedGDriveFileName && !showGDrivePicker ? (
              <div className="flex items-center gap-2">
                <span className="truncate rounded border border-ui-elevated-more bg-ui-elevated px-3 py-2 text-sm text-text-main flex-1">
                  {values.title || selectedGDriveFileName}
                </span>
                <button
                  type="button"
                  onClick={() => setShowGDrivePicker(true)}
                  className="shrink-0 rounded bg-ui-elevated-more px-2 py-2 text-xs text-text-soft hover:text-text-main"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGDrivePicker(true)}
                className="rounded border border-dashed border-ui-elevated-more bg-ui-elevated px-3 py-2 text-sm text-text-soft hover:text-text-main hover:border-text-soft transition-colors"
              >
                Browse Google Drive…
              </button>
            )}
          </div>
        )}
      </div>

      {showGDrivePicker && videoSource === "gdrive" && (
        <GDrivePicker
          onSelect={handleGDriveSelect}
          onCancel={() => setShowGDrivePicker(false)}
        />
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-soft">
            Duration (s)
          </span>
          <input
            type="number"
            min={0}
            value={values.durationSeconds}
            onChange={(e) =>
              setValue("durationSeconds", e.target.value ? e.target.valueAsNumber : "")
            }
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-soft">
            Date
          </span>
          <input
            type="date"
            value={values.date}
            onChange={(e) => setValue("date", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-soft">
            Opponent
          </span>
          <input
            type="text"
            value={values.opponent}
            onChange={(e) => setValue("opponent", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-soft">
            Result
          </span>
          <input
            type="text"
            value={values.result}
            onChange={(e) => setValue("result", e.target.value)}
            placeholder="e.g. 21-19 21-17"
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-soft">
            Notes
          </span>
          <input
            type="text"
            value={values.notes}
            onChange={(e) => setValue("notes", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-soft">
            Category
          </span>
          <select
            value={values.category}
            onChange={(e) => setValue("category", e.target.value)}
            className={inputClass}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading" || !String(values.videoPath).trim()}
          className="rounded bg-ui-elevated-more px-4 py-2 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading"
            ? mode === "create"
              ? "Adding…"
              : "Saving…"
            : mode === "create"
              ? "Add match"
              : "Save"}
        </button>
        {message && (
          <p
            className={`text-sm ${
              status === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-text-soft"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
