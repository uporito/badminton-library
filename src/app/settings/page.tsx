"use client";

import { useState, useEffect, useRef } from "react";
import {
  getStoredTheme,
  setStoredTheme,
  getStoredVideoFolderPath,
  setStoredVideoFolderPath,
  type ThemeValue,
} from "@/lib/settings";
import {
  GoogleDriveLogo,
  YoutubeLogo,
  CheckCircle,
  XCircle,
  HardDrive,
  CaretDown,
} from "@phosphor-icons/react";

function applyTheme(value: ThemeValue) {
  const isDark =
    value === "dark" ||
    (value === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

interface GDriveStatus {
  configured: boolean;
  serviceAccountEmail: string | null;
}

interface YouTubeStatus {
  configured: boolean;
}

const SECTION_HEADING =
  "text-sm font-medium text-text-soft uppercase tracking-wide";
const SUBSECTION_HEADING = "text-sm font-medium text-text-main";

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeValue>("system");
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const [videoFolderPath, setVideoFolderPath] = useState("");
  const [gdriveStatus, setGdriveStatus] = useState<GDriveStatus | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<YouTubeStatus | null>(null);

  useEffect(() => {
    if (!themeDropdownOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(e.target as Node)
      ) {
        setThemeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [themeDropdownOpen]);

  useEffect(() => {
    setTheme(getStoredTheme());
    setVideoFolderPath(getStoredVideoFolderPath());
    fetch("/api/gdrive/status")
      .then((r) => r.json())
      .then((d) => setGdriveStatus(d))
      .catch(() =>
        setGdriveStatus({ configured: false, serviceAccountEmail: null }),
      );
    fetch("/api/youtube/status")
      .then((r) => r.json())
      .then((d) => setYoutubeStatus(d))
      .catch(() => setYoutubeStatus({ configured: false }));
  }, []);

  function handleThemeChange(value: ThemeValue) {
    setTheme(value);
    setStoredTheme(value);
    applyTheme(value);
  }

  function handleVideoFolderPathChange(value: string) {
    setVideoFolderPath(value);
    setStoredVideoFolderPath(value);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-main">Settings</h1>

      {/* Appearance */}
      <section className="mb-8 space-y-4">
        <h2 className={SECTION_HEADING}>Appearance</h2>

        <div className="space-y-3">
          <h3 className={SUBSECTION_HEADING}>Display mode</h3>
          <div className="frame relative z-10 flex items-center justify-between gap-4 rounded-xl px-4 py-3">
            <span className="text-sm font-medium text-text-main">Theme</span>
            <div ref={themeDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setThemeDropdownOpen((o) => !o)}
                className="flex items-center justify-between gap-1.5 rounded-md bg-ui-elevated px-2.5 py-1.5 text-sm font-medium text-text-main hover:bg-ui-elevated-more transition-colors focus:outline-none focus:ring-1 focus:ring-ui-elevated-more"
                aria-haspopup="listbox"
                aria-expanded={themeDropdownOpen}
                aria-label="Theme"
              >
                <span className="truncate">
                  {theme === "light"
                    ? "Light"
                    : theme === "dark"
                      ? "Dark"
                      : "System"}
                </span>
                <CaretDown
                  className={`h-3 w-3 shrink-0 text-text-soft transition-transform ${themeDropdownOpen ? "rotate-180" : ""}`}
                  weight="bold"
                  aria-hidden
                />
              </button>
              {themeDropdownOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1.5 min-w-[8rem] overflow-hidden rounded-xl bg-ui-elevated p-1.5 shadow-[0_8px_24px_-4px_rgb(0_0_0_/0.15),0_4px_12px_-2px_rgb(0_0_0_/0.10)] dark:shadow-[0_12px_32px_-4px_rgb(0_0_0_/0.45),0_6px_16px_-4px_rgb(0_0_0_/0.30)]"
                  role="listbox"
                >
                  <ul className="space-y-px">
                    {(
                      [
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                        { value: "system", label: "System" },
                      ] as const
                    ).map(({ value, label }) => {
                      const selected = theme === value;
                      return (
                        <li key={value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => {
                              handleThemeChange(value);
                              setThemeDropdownOpen(false);
                            }}
                            className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                              selected
                                ? "bg-ui-elevated-more text-text-main"
                                : "text-text-soft hover:bg-ui-elevated-more"
                            }`}
                          >
                            {label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Video Sources */}
      <section className="mb-8 space-y-4">
        <h2 className={SECTION_HEADING}>Video Sources</h2>

        <div className="space-y-6">
          {/* Default Local Folder */}
          <div className="space-y-2">
            <h3 className={`${SUBSECTION_HEADING} flex items-center gap-2`}>
              <HardDrive size={18} className="text-text-soft" weight="fill" />
              Default Local Folder
            </h3>
            <div className="frame rounded-xl px-4 py-3">
              <label
                htmlFor="video-folder-path"
                className="mb-2 block text-sm font-medium text-text-main"
              >
                Video folder path
              </label>
              <input
                id="video-folder-path"
                type="text"
                value={videoFolderPath}
                onChange={(e) => handleVideoFolderPathChange(e.target.value)}
                placeholder="e.g. C:\Videos\badminton"
                className="w-full rounded-md border border-ui-elevated-more bg-ui-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
              />
              <p className="mt-1.5 text-xs text-text-soft">
                Default folder for the Import panel. Server uses VIDEO_ROOT for
                actual file resolution.
              </p>
            </div>
          </div>

          {/* Google Drive */}
          <div className="space-y-2">
            <h3 className={`${SUBSECTION_HEADING} flex items-center gap-2`}>
              <GoogleDriveLogo size={18} className="text-text-soft" />
              Google Drive
            </h3>
            <div className="frame rounded-xl px-4 py-3">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-medium text-text-main">
                  Google Drive integration
                </span>
                {gdriveStatus && (
                  <span className="ml-auto flex items-center gap-1 text-xs">
                    {gdriveStatus.configured ? (
                      <>
                        <CheckCircle
                          size={14}
                          className="text-ui-success"
                          weight="fill"
                        />
                        <span className="text-ui-success">Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle
                          size={14}
                          className="text-text-soft"
                          weight="fill"
                        />
                        <span className="text-text-soft">Not configured</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {gdriveStatus?.configured &&
                gdriveStatus.serviceAccountEmail && (
                  <div className="mb-3 rounded-md bg-ui-elevated px-3 py-2">
                    <p className="text-xs text-text-soft">Service account</p>
                    <p className="break-all text-xs font-mono text-text-main">
                      {gdriveStatus.serviceAccountEmail}
                    </p>
                  </div>
                )}

              <div className="space-y-2 text-xs text-text-soft">
                <p className="text-sm font-medium">
                  Setup instructions
                </p>
                <ol className="list-inside list-decimal space-y-1.5 pl-1">
                  <li>
                    Create a Google Cloud project (or use existing) at{" "}
                    <a
                      href="https://console.cloud.google.com/projectcreate"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-text-main"
                    >
                      Google Cloud Console.
                    </a>
                  </li>
                  <li>
                    Enable the <strong>Google Drive API</strong> for your
                    project.
                  </li>
                  <li>
                    Create a Service Account under IAM & Admin &gt; Service
                    Accounts
                  </li>
                  <li>Download the service account JSON key file.</li>
                  <li>
                    Set{" "}
                    <code className="rounded bg-ui-elevated px-1 py-0.5">
                      GOOGLE_SERVICE_ACCOUNT_KEY
                    </code>{" "}
                    in your{" "}
                    <code className="rounded bg-ui-elevated px-1 py-0.5">
                      .env
                    </code>{" "}
                    file to the JSON content of the key file (as a single-line
                    string).
                  </li>
                  <li>
                    Share your Google Drive folder(s) with the service account
                    email (give it <strong>Viewer</strong> access).
                  </li>
                  <li>Restart the dev server.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* YouTube */}
          <div className="space-y-2">
            <h3 className={`${SUBSECTION_HEADING} flex items-center gap-2`}>
              <YoutubeLogo size={18} className="text-text-soft" weight="fill" />
              YouTube
            </h3>
            <div className="frame rounded-xl px-4 py-3">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-medium text-text-main">
                  YouTube integration
                </span>
                {youtubeStatus && (
                  <span className="ml-auto flex items-center gap-1 text-xs">
                    {youtubeStatus.configured ? (
                      <>
                        <CheckCircle
                          size={14}
                          className="text-ui-success"
                          weight="fill"
                        />
                        <span className="text-ui-success">Configured</span>
                      </>
                    ) : (
                      <>
                        <XCircle
                          size={14}
                          className="text-text-soft"
                          weight="fill"
                        />
                        <span className="text-text-soft">Not configured</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs text-text-soft">
                <p className="text-sm font-medium">
                  Setup instructions
                </p>
                <ol className="list-inside list-decimal space-y-1.5 pl-1">
                  <li>
                    Use your existing Google Cloud project (or create one) at{" "}
                    <a
                      href="https://console.cloud.google.com/projectcreate"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-text-main"
                    >
                      Google Cloud Console
                    </a>
                    .
                  </li>
                  <li>
                    Enable the{" "}
                    <a
                      href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-text-main"
                    >
                      YouTube Data API v3
                    </a>{" "}
                    for your project.
                  </li>
                  <li>
                    Go to{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-text-main"
                    >
                      APIs & Services &gt; Credentials
                    </a>{" "}
                    and create an <strong>API key</strong>.
                  </li>
                  <li>
                    Add{" "}
                    <code className="rounded bg-ui-elevated px-1 py-0.5">
                      YOUTUBE_API_KEY=your_key
                    </code>{" "}
                    to your{" "}
                    <code className="rounded bg-ui-elevated px-1 py-0.5">
                      .env
                    </code>{" "}
                    file.
                  </li>
                  <li>Restart the dev server.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
