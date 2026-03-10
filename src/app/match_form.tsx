"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { MatchRow } from "@/lib/get_match_by_id";
import { matchCategoryEnum, type VideoSource } from "@/db/schema";
import { GDrivePicker } from "./gdrive_picker";
import { DatePicker } from "@/components/date_picker";
import { HardDrive, GoogleDriveLogo, CaretDown } from "@phosphor-icons/react";

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
    myDescription: "",
    opponentDescription: "",
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
    myDescription: m.myDescription ?? "",
    opponentDescription: m.opponentDescription ?? "",
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
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [categoryDropdownOpen]);

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
      myDescription: String(values.myDescription).trim() || undefined,
      opponentDescription: String(values.opponentDescription).trim() || undefined,
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

  const textInputClass =
    "rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main placeholder:text-text-soft/50 focus:outline-none focus:ring-1 focus:ring-ui-elevated-more";

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
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">
            Title <span className="text-text-soft/60">(required)</span>
          </span>
          <input
            type="text"
            value={values.title}
            onChange={(e) => setValue("title", e.target.value)}
            required
            className={textInputClass}
            placeholder="e.g. My match"
          />
        </label>

        {videoSource === "local" ? (
          <label className="flex flex-col gap-0.5">
            <span className="text-text-soft text-sm">
              Video path <span className="text-text-soft/60">(required)</span>
            </span>
            <input
              type="text"
              value={values.videoPath}
              onChange={(e) => setValue("videoPath", e.target.value)}
              required
              className={textInputClass}
              placeholder="e.g. my_video.mp4"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-text-soft text-sm">
              Google Drive video <span className="text-text-soft/60">(required)</span>
            </span>
            {selectedGDriveFileName && !showGDrivePicker ? (
              <div className="flex items-center gap-2">
                <span className="truncate rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main flex-1">
                  {values.title || selectedGDriveFileName}
                </span>
              <button
                type="button"
                onClick={() => setShowGDrivePicker(true)}
                className="shrink-0 rounded-md bg-ui-elevated-more px-2 py-1.5 text-xs text-text-soft hover:text-text-main"
              >
                Change
              </button>
            </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGDrivePicker(true)}
                className="rounded-md border border-dashed border-ui-elevated-more bg-ui-elevated px-2.5 py-1.5 text-sm text-text-soft hover:text-text-main hover:border-text-soft transition-colors"
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
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Duration (s)</span>
          <input
            type="number"
            min={0}
            value={values.durationSeconds}
            onChange={(e) =>
              setValue("durationSeconds", e.target.value ? e.target.valueAsNumber : "")
            }
            className={textInputClass}
          />
        </label>
        <div className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Date</span>
          <DatePicker
            value={String(values.date)}
            onChange={(iso) => setValue("date", iso)}
          />
        </div>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Opponent</span>
          <input
            type="text"
            value={values.opponent}
            onChange={(e) => setValue("opponent", e.target.value)}
            className={textInputClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Result</span>
          <input
            type="text"
            value={values.result}
            onChange={(e) => setValue("result", e.target.value)}
            placeholder="e.g. 21-19 21-17"
            className={textInputClass}
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Notes</span>
          <input
            type="text"
            value={values.notes}
            onChange={(e) => setValue("notes", e.target.value)}
            className={textInputClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Category</span>
          <div ref={categoryDropdownRef} className="relative w-full">
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-1.5 rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main hover:bg-ui-elevated-more transition-colors focus:outline-none focus:ring-1 focus:ring-ui-elevated-more"
              aria-haspopup="listbox"
              aria-expanded={categoryDropdownOpen}
              aria-label="Category"
            >
              <span className="truncate">{String(values.category)}</span>
              <CaretDown
                className={`h-3 w-3 shrink-0 text-text-soft transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`}
                weight="bold"
                aria-hidden
              />
            </button>
            {categoryDropdownOpen && (
              <div
                className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-0 overflow-hidden rounded-xl bg-ui-elevated p-1.5 shadow-[0_8px_24px_-4px_rgb(0_0_0_/0.15),0_4px_12px_-2px_rgb(0_0_0_/0.10)] dark:shadow-[0_12px_32px_-4px_rgb(0_0_0_/0.45),0_6px_16px_-4px_rgb(0_0_0_/0.30)]"
                role="listbox"
              >
                <ul className="space-y-px">
                  {CATEGORY_OPTIONS.map((c) => {
                    const selected = values.category === c;
                    return (
                      <li key={c}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setValue("category", c);
                            setCategoryDropdownOpen(false);
                          }}
                          className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                            selected
                              ? "bg-ui-elevated-more text-text-main"
                              : "text-text-soft hover:bg-ui-elevated-more"
                          }`}
                        >
                          {c}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">
            My description <span className="text-text-soft/60">(optional)</span>
          </span>
          <input
            type="text"
            value={values.myDescription}
            onChange={(e) => setValue("myDescription", e.target.value)}
            placeholder="e.g. wearing red shirt, left-handed"
            className={textInputClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">
            Opponent description <span className="text-text-soft/60">(optional)</span>
          </span>
          <input
            type="text"
            value={values.opponentDescription}
            onChange={(e) => setValue("opponentDescription", e.target.value)}
            placeholder="e.g. taller, wearing blue shirt"
            className={textInputClass}
          />
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
