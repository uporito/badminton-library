"use client";

import { useState, useEffect } from "react";
import {
  getStoredTheme,
  setStoredTheme,
  getStoredVideoFolderPath,
  setStoredVideoFolderPath,
  type ThemeValue,
} from "@/lib/settings";
import { GoogleDriveLogo, CheckCircle, XCircle, Sparkle } from "@phosphor-icons/react";

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

interface GeminiStatus {
  configured: boolean;
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeValue>("system");
  const [videoFolderPath, setVideoFolderPath] = useState("");
  const [gdriveStatus, setGdriveStatus] = useState<GDriveStatus | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
    setVideoFolderPath(getStoredVideoFolderPath());
    fetch("/api/gdrive/status")
      .then((r) => r.json())
      .then((d) => setGdriveStatus(d))
      .catch(() => setGdriveStatus({ configured: false, serviceAccountEmail: null }));
    fetch("/api/gemini/status")
      .then((r) => r.json())
      .then((d) => setGeminiStatus(d))
      .catch(() => setGeminiStatus({ configured: false }));
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
      <h1 className="text-2xl font-semibold text-text-main mb-6">
        Settings
      </h1>

      <section className="space-y-4 mb-8">
        <h2 className="text-sm font-medium text-text-soft uppercase tracking-wide">
          Appearance
        </h2>
        <div className="frame flex items-center justify-between gap-4 rounded-xl px-4 py-3">
          <label
            htmlFor="dark-mode"
            className="text-sm font-medium text-text-main"
          >
            Dark mode
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-soft">
              {theme === "light"
                ? "Off"
                : theme === "dark"
                  ? "On"
                  : "System"}
            </span>
            <select
              id="dark-mode"
              value={theme}
              onChange={(e) =>
                handleThemeChange(e.target.value as ThemeValue)
              }
              className="rounded-md border border-ui-elevated-more bg-ui-elevated text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-sm font-medium text-text-soft uppercase tracking-wide">
          Video — Local
        </h2>
        <div className="frame rounded-xl px-4 py-3">
          <label
            htmlFor="video-folder-path"
            className="block text-sm font-medium text-text-main mb-2"
          >
            Video folder path
          </label>
          <input
            id="video-folder-path"
            type="text"
            value={videoFolderPath}
            onChange={(e) => handleVideoFolderPathChange(e.target.value)}
            placeholder="e.g. videos or C:\Videos\badminton"
            className="w-full rounded-md border border-ui-elevated-more bg-ui-elevated text-foreground px-3 py-2 text-sm placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
          />
          <p className="mt-1.5 text-xs text-text-soft">
            Default path used when adding new matches. Server uses VIDEO_ROOT for
            actual file resolution.
          </p>
        </div>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-sm font-medium text-text-soft uppercase tracking-wide">
          Analyze with AI
        </h2>
        <div className="frame rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Sparkle size={20} className="text-text-soft" weight="fill" />
            <span className="text-sm font-medium text-text-main">
              Gemini API (video analysis)
            </span>
            {geminiStatus && (
              <span className="ml-auto flex items-center gap-1 text-xs">
                {geminiStatus.configured ? (
                  <>
                    <CheckCircle size={14} className="text-ui-success" weight="fill" />
                    <span className="text-ui-success">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} className="text-text-soft" weight="fill" />
                    <span className="text-text-soft">Not configured</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs text-text-soft">
            <p className="font-medium text-text-main text-sm">Setup</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                Get a free API key from{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-text-main"
                >
                  Google AI Studio
                </a>
                .
              </li>
              <li>
                Add <code className="rounded bg-ui-elevated px-1 py-0.5">GEMINI_API_KEY=your_key</code> to
                your <code className="rounded bg-ui-elevated px-1 py-0.5">.env</code> file.
              </li>
              <li>Restart the dev server.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-text-soft uppercase tracking-wide">
          Video — Google Drive
        </h2>
        <div className="frame rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <GoogleDriveLogo size={20} className="text-text-soft" />
            <span className="text-sm font-medium text-text-main">
              Google Drive integration
            </span>
            {gdriveStatus && (
              <span className="ml-auto flex items-center gap-1 text-xs">
                {gdriveStatus.configured ? (
                  <>
                    <CheckCircle size={14} className="text-ui-success" weight="fill" />
                    <span className="text-ui-success">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} className="text-text-soft" weight="fill" />
                    <span className="text-text-soft">Not configured</span>
                  </>
                )}
              </span>
            )}
          </div>

          {gdriveStatus?.configured && gdriveStatus.serviceAccountEmail && (
            <div className="mb-3 rounded-md bg-ui-elevated px-3 py-2">
              <p className="text-xs text-text-soft">Service account</p>
              <p className="text-xs font-mono text-text-main break-all">
                {gdriveStatus.serviceAccountEmail}
              </p>
            </div>
          )}

          <div className="space-y-2 text-xs text-text-soft">
            <p className="font-medium text-text-main text-sm">Setup instructions</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>Create a Google Cloud project (or use existing) at {" "}
                <a
                  href="https://console.cloud.google.com/projectcreate"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-text-main"
                >
                   Google Cloud Console.
                </a>
              </li>
              <li>Enable the <strong>Google Drive API</strong> for your project.</li>
              <li>Create a Service Account under IAM & Admin {'>'} Service Accounts</li>
              <li>Download the service account JSON key file.</li>
              <li>
                Set <code className="rounded bg-ui-elevated px-1 py-0.5">GOOGLE_SERVICE_ACCOUNT_KEY</code> in
                your <code className="rounded bg-ui-elevated px-1 py-0.5">.env</code> file to the JSON
                content of the key file (as a single-line string).
              </li>
              <li>
                Share your Google Drive folder(s) with the service account email
                (give it <strong>Viewer</strong> access).
              </li>
              <li>Restart the dev server.</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
