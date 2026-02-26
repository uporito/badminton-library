"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchRow } from "@/lib/get_match_by_id";
import { matchCategoryEnum } from "@/db/schema";

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

  function setValue(name: string, value: string | number) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const body = {
      title: String(values.title).trim() || undefined,
      videoPath: String(values.videoPath).trim(),
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
    "rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {mode === "create" ? "Add match" : "Edit match"}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
          className="rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
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
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
