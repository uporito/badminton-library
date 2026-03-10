"use client";

import { useState, useRef, useEffect } from "react";
import {
  GoogleDriveLogo,
  YoutubeLogo,
  HardDrive,
  CaretDown,
  CloudArrowDown,
} from "@phosphor-icons/react";
import { GDriveImportPanel } from "./gdrive_import_panel";
import { YouTubeImportPanel } from "./youtube_import_panel";
import { LocalImportPanel } from "./local_import_panel";

type SourceTab = "local" | "gdrive" | "youtube";

interface ImportPanelProps {
  gdriveConfigured: boolean;
  youtubeConfigured: boolean;
  existingMatches: { id: number; videoPath: string; videoSource: string }[];
}

const TAB_CONFIG: Record<
  SourceTab,
  { label: string; icon: typeof GoogleDriveLogo }
> = {
  local: { label: "Local", icon: HardDrive },
  gdrive: { label: "Google Drive", icon: GoogleDriveLogo },
  youtube: { label: "YouTube", icon: YoutubeLogo },
};

export function ImportPanel({
  gdriveConfigured,
  youtubeConfigured,
  existingMatches,
}: ImportPanelProps) {
  const availableTabs: SourceTab[] = ["local"];
  if (gdriveConfigured) availableTabs.push("gdrive");
  if (youtubeConfigured) availableTabs.push("youtube");

  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<SourceTab>("local");
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [expanded]);

  return (
    <section ref={containerRef} className="relative cursor-pointer">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="frame flex w-full items-center justify-between gap-3 rounded-xl p-4"
      >
        <div className="flex items-center gap-2">
          <CloudArrowDown size={18} className="text-text-soft" />
          <h2 className="text-sm font-semibold text-text-main">
            Import videos
          </h2>
        </div>
        <CaretDown
          size={14}
          className={`text-text-soft transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 frame rounded-xl p-4 shadow-lg">
          {availableTabs.length > 1 && (
            <div className="mb-3 flex rounded-lg bg-ui-elevated p-0.5">
              {availableTabs.map((tab) => {
                const cfg = TAB_CONFIG[tab];
                const Icon = cfg.icon;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-ui-elevated-more text-text-main"
                        : "text-text-soft hover:text-text-main"
                    }`}
                  >
                    <Icon size={14} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "local" && (
            <LocalImportPanel existingMatches={existingMatches} />
          )}
          {activeTab === "gdrive" && gdriveConfigured && (
            <GDriveImportPanel existingMatches={existingMatches} />
          )}
          {activeTab === "youtube" && youtubeConfigured && (
            <YouTubeImportPanel existingMatches={existingMatches} />
          )}
        </div>
      )}
    </section>
  );
}
