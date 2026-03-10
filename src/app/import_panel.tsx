"use client";

import { useState } from "react";
import { CaretDown, CloudArrowDown, GoogleDriveLogo, YoutubeLogo } from "@phosphor-icons/react";
import { GDriveImportPanel } from "./gdrive_import_panel";
import { YouTubeImportSource } from "./youtube_import_source";

interface ExistingMatch {
  id: number;
  videoPath: string;
  videoSource: string;
}

interface ImportPanelProps {
  existingMatches: ExistingMatch[];
  gdriveConfigured: boolean;
  youtubeConfigured: boolean;
}

type ImportSource = "gdrive" | "youtube";

export function ImportPanel({
  existingMatches,
  gdriveConfigured,
  youtubeConfigured,
}: ImportPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeSource, setActiveSource] = useState<ImportSource>(
    gdriveConfigured ? "gdrive" : "youtube"
  );

  const hasMultipleSources = gdriveConfigured && youtubeConfigured;
  const hasAnySource = gdriveConfigured || youtubeConfigured;
  const gdriveMatches = existingMatches.filter((m) => m.videoSource === "gdrive");
  const youtubeMatches = existingMatches.filter((m) => m.videoSource === "youtube");

  return (
    <section className="frame rounded-xl p-4">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <CloudArrowDown size={18} className="text-text-soft" />
          <h2 className="text-sm font-semibold text-text-main">Import</h2>
        </div>
        <CaretDown
          size={14}
          className={`text-text-soft transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <>
          {!hasAnySource ? (
            <p className="mt-3 text-xs text-text-soft">
              Configure Google Drive (<code className="rounded bg-ui-elevated px-1">GOOGLE_SERVICE_ACCOUNT_KEY</code>) or
              YouTube (<code className="rounded bg-ui-elevated px-1">YOUTUBE_API_KEY</code>) in your environment to import videos.
            </p>
          ) : (
            <>
              {hasMultipleSources && (
                <div className="mt-3 flex rounded-lg border border-ui-elevated-more p-1">
                  <button
                    type="button"
                    onClick={() => setActiveSource("gdrive")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      activeSource === "gdrive"
                        ? "bg-ui-elevated-more text-foreground"
                        : "text-text-soft hover:bg-ui-elevated"
                    }`}
                  >
                    <GoogleDriveLogo size={16} />
                    Google Drive
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSource("youtube")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      activeSource === "youtube"
                        ? "bg-ui-elevated-more text-foreground"
                        : "text-text-soft hover:bg-ui-elevated"
                    }`}
                  >
                    <YoutubeLogo size={16} />
                    YouTube
                  </button>
                </div>
              )}

              {(!hasMultipleSources && gdriveConfigured) || activeSource === "gdrive" ? (
                <GDriveImportPanel existingMatches={gdriveMatches} />
              ) : (
                <YouTubeImportSource existingMatches={youtubeMatches} />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
