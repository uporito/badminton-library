"use client";

import { useState, useEffect } from "react";
import {
  getStoredTheme,
  setStoredTheme,
  getStoredVideoFolderPath,
  setStoredVideoFolderPath,
  type ThemeValue,
} from "@/lib/settings";

function applyTheme(value: ThemeValue) {
  const isDark =
    value === "dark" ||
    (value === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeValue>("system");
  const [videoFolderPath, setVideoFolderPath] = useState("");

  useEffect(() => {
    setTheme(getStoredTheme());
    setVideoFolderPath(getStoredVideoFolderPath());
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
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
        Settings
      </h1>

      <section className="space-y-4 mb-8">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Appearance
        </h2>
        <div className="frame-glass flex items-center justify-between gap-4 rounded-xl px-4 py-3">
          <label
            htmlFor="dark-mode"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Dark mode
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
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
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Video
        </h2>
        <div className="frame-glass rounded-xl px-4 py-3">
          <label
            htmlFor="video-folder-path"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Video folder path
          </label>
          <input
            id="video-folder-path"
            type="text"
            value={videoFolderPath}
            onChange={(e) => handleVideoFolderPathChange(e.target.value)}
            placeholder="e.g. videos or C:\Videos\badminton"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Default path used when adding new matches. Server uses VIDEO_ROOT for
            actual file resolution.
          </p>
        </div>
      </section>
    </div>
  );
}