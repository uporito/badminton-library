/**
 * Client-side settings keys and defaults.
 * Persisted in localStorage.
 */
export const SETTINGS_KEYS = {
  THEME: "settings.theme",
  VIDEO_FOLDER_PATH: "settings.videoFolderPath",
} as const;

export type ThemeValue = "light" | "dark" | "system";

export function getStoredTheme(): ThemeValue {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(SETTINGS_KEYS.THEME);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function setStoredTheme(value: ThemeValue): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEYS.THEME, value);
}

export function getStoredVideoFolderPath(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SETTINGS_KEYS.VIDEO_FOLDER_PATH) ?? "";
}

export function setStoredVideoFolderPath(path: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEYS.VIDEO_FOLDER_PATH, path);
}
