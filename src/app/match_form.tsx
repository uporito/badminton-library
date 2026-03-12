"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { MatchRow } from "@/lib/get_match_by_id";
import { matchCategoryEnum, type VideoSource } from "@/db/schema";
import { GDrivePicker } from "./gdrive_picker";
import { DatePicker } from "@/components/date_picker";
import { PlayerPicker } from "@/components/player_picker";
import { HardDrive, GoogleDriveLogo, CaretDown } from "@phosphor-icons/react";

const CATEGORY_OPTIONS = matchCategoryEnum;

export interface MatchFormProps {
  mode: "create" | "edit";
  initialMatch?: MatchRow;
  onSuccess?: () => void;
}

function isDoublesCategory(cat: string) {
  return cat === "Doubles" || cat === "Mixed";
}

const PARTNER_SPECIAL_OPTIONS = [
  { key: "unknown", label: "Unknown" },
];

interface FormValues {
  title: string;
  videoPath: string;
  videoSource: string;
  durationSeconds: number | "";
  date: string;
  result: string;
  notes: string;
  category: string;
  opponent1Id: number | null;
  opponent2Id: number | null;
  /** number = player id, "unknown" = special, null = no partner */
  partnerValue: number | string | null;
  wonByMe: boolean | null;
}

function emptyValues(): FormValues {
  return {
    title: "",
    videoPath: "",
    videoSource: "local",
    durationSeconds: "",
    date: "",
    result: "",
    notes: "",
    category: "Uncategorized",
    opponent1Id: null,
    opponent2Id: null,
    partnerValue: null,
    wonByMe: null,
  };
}

function matchToValues(m: MatchRow): FormValues {
  let partnerValue: number | string | null = null;
  if (m.partnerStatus === "unknown") partnerValue = "unknown";
  else if (m.partnerStatus === "player" && m.partner) partnerValue = m.partner.id;

  return {
    title: m.title ?? "",
    videoPath: m.videoPath ?? "",
    videoSource: m.videoSource ?? "local",
    durationSeconds: m.durationSeconds ?? "",
    date: m.date ?? "",
    result: m.result ?? "",
    notes: m.notes ?? "",
    category: m.category ?? "Uncategorized",
    opponent1Id: m.opponents[0]?.id ?? null,
    opponent2Id: m.opponents[1]?.id ?? null,
    partnerValue,
    wonByMe: m.wonByMe ?? null,
  };
}

function derivePartnerFields(partnerValue: number | string | null) {
  if (typeof partnerValue === "number") {
    return { partnerStatus: "player" as const, partnerId: partnerValue };
  }
  if (partnerValue === "unknown") {
    return { partnerStatus: "unknown" as const, partnerId: null };
  }
  return { partnerStatus: "none" as const, partnerId: null };
}

export function MatchForm({
  mode,
  initialMatch,
  onSuccess,
}: MatchFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(
    mode === "edit" && initialMatch ? matchToValues(initialMatch) : emptyValues(),
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

  const videoSource = values.videoSource as VideoSource;
  const showDoubles = isDoublesCategory(values.category);

  function setField<K extends keyof FormValues>(name: K, value: FormValues[K]) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "category" && !isDoublesCategory(String(value))) {
        next.opponent2Id = null;
        next.partnerValue = null;
      }
      return next;
    });
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

    const opponentIds: number[] = [];
    if (values.opponent1Id) opponentIds.push(values.opponent1Id);
    if (values.opponent2Id) opponentIds.push(values.opponent2Id);

    const { partnerStatus, partnerId } = derivePartnerFields(values.partnerValue);

    const body = {
      title: values.title.trim() || undefined,
      videoPath: values.videoPath.trim(),
      videoSource: values.videoSource as VideoSource,
      durationSeconds:
        values.durationSeconds === "" ? undefined : Number(values.durationSeconds),
      date: values.date.trim() || undefined,
      opponentIds,
      partnerId,
      partnerStatus,
      wonByMe: values.wonByMe,
      result: values.result.trim() || undefined,
      notes: values.notes.trim() || undefined,
      category: values.category,
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
            data.error ?? data.details?.title?.[0] ?? `Error ${res.status}`,
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
            data.error ?? data.details?.title?.[0] ?? `Error ${res.status}`,
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

  const selectedGDriveFileName =
    videoSource === "gdrive" && values.videoPath ? values.videoPath : "";

  const partnerIdNum = typeof values.partnerValue === "number" ? values.partnerValue : null;
  const allPickedPlayerIds = [
    values.opponent1Id,
    values.opponent2Id,
    partnerIdNum,
  ].filter((id): id is number => id != null);

  return (
    <form
      onSubmit={handleSubmit}
      className="frame flex flex-col gap-3 rounded-xl p-4"
    >
      <h2 className="text-sm font-semibold text-text-main">
        {mode === "create" ? "Add match" : "Edit match"}
      </h2>

      {/* ── Create-only: video source tabs ──────────────────────────── */}
      {mode === "create" && gdriveAvailable && (
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

      {/* ── Create-only: title + video path ─────────────────────────── */}
      {mode === "create" && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-soft text-sm">
                Title <span className="text-text-soft/60">(required)</span>
              </span>
              <input
                type="text"
                value={values.title}
                onChange={(e) => setField("title", e.target.value)}
                required
                className={textInputClass}
                placeholder="e.g. My match"
              />
            </label>

            {videoSource === "local" ? (
              <label className="flex flex-col gap-0.5">
                <span className="text-text-soft text-sm">
                  Video path{" "}
                  <span className="text-text-soft/60">(required)</span>
                </span>
                <input
                  type="text"
                  value={values.videoPath}
                  onChange={(e) => setField("videoPath", e.target.value)}
                  required
                  className={textInputClass}
                  placeholder="e.g. my_video.mp4"
                />
              </label>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="text-text-soft text-sm">
                  Google Drive video{" "}
                  <span className="text-text-soft/60">(required)</span>
                </span>
                {selectedGDriveFileName && !showGDrivePicker ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main">
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
                    className="rounded-md border border-dashed border-ui-elevated-more bg-ui-elevated px-2.5 py-1.5 text-sm text-text-soft hover:border-text-soft hover:text-text-main transition-colors"
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
        </>
      )}

      {/* ── Row 1 (edit): Title ─────────────────────────────────────── */}
      {mode === "edit" && (
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Title</span>
          <input
            type="text"
            value={values.title}
            onChange={(e) => setField("title", e.target.value)}
            required
            className={textInputClass}
            placeholder="e.g. My match"
          />
        </label>
      )}

      {/* ── Row 2: Category + Players ───────────────────────────────── */}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
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
              <span className="truncate">{values.category}</span>
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
                            setField("category", c);
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
        </div>

        {showDoubles ? (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="text-text-soft text-sm">Partner</span>
              <PlayerPicker
                value={values.partnerValue}
                onChange={(val) => setField("partnerValue", val)}
                exclude={allPickedPlayerIds.filter(
                  (id) => id !== partnerIdNum,
                )}
                specialOptions={PARTNER_SPECIAL_OPTIONS}
                placeholder="Select partner"
                label="Partner"
                clearable
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-text-soft text-sm">Opponent 1</span>
              <PlayerPicker
                value={values.opponent1Id}
                onChange={(id) =>
                  setField("opponent1Id", typeof id === "number" ? id : null)
                }
                exclude={allPickedPlayerIds.filter(
                  (id) => id !== values.opponent1Id,
                )}
                placeholder="Select opponent"
                label="Opponent 1"
                clearable
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-text-soft text-sm">Opponent 2</span>
              <PlayerPicker
                value={values.opponent2Id}
                onChange={(id) =>
                  setField("opponent2Id", typeof id === "number" ? id : null)
                }
                exclude={allPickedPlayerIds.filter(
                  (id) => id !== values.opponent2Id,
                )}
                placeholder="Select opponent 2"
                label="Opponent 2"
                clearable
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-0.5 sm:col-span-3">
            <span className="text-text-soft text-sm">Opponent</span>
            <PlayerPicker
              value={values.opponent1Id}
              onChange={(id) =>
                setField("opponent1Id", typeof id === "number" ? id : null)
              }
              exclude={allPickedPlayerIds.filter(
                (id) => id !== values.opponent1Id,
              )}
              placeholder="Select opponent"
              label="Opponent"
              clearable
            />
          </div>
        )}
      </div>

      {/* ── Row 3: Date, Result, Won? ───────────────────────────────── */}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <span className="text-text-soft text-sm">Date</span>
          <DatePicker
            value={values.date}
            onChange={(iso) => setField("date", iso)}
          />
        </div>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Result</span>
          <input
            type="text"
            value={values.result}
            onChange={(e) => setField("result", e.target.value)}
            placeholder="e.g. 21-19 21-17"
            className={textInputClass}
          />
        </label>
        <div className="flex flex-col gap-0.5">
          <span className="text-text-soft text-sm">Won?</span>
          <div className="flex gap-1 rounded-lg bg-ui-elevated p-0.5">
            {([
              { val: null, label: "—" },
              { val: true, label: "Won" },
              { val: false, label: "Lost" },
            ] as const).map(({ val, label }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setField("wonByMe", val)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  values.wonByMe === val
                    ? "bg-ui-elevated-more text-text-main shadow-sm"
                    : "text-text-soft hover:text-text-main"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Notes ────────────────────────────────────────────── */}
      <label className="flex flex-col gap-0.5">
        <span className="text-text-soft text-sm">Notes</span>
        <textarea
          value={values.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={3}
          className={`${textInputClass} resize-y`}
          placeholder="Match notes…"
        />
      </label>

      {/* ── Submit ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading" || !values.videoPath.trim()}
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
