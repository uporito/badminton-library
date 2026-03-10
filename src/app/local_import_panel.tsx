"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  CaretRight,
  CaretDown,
  ArrowLeft,
  MagnifyingGlass,
  Check,
  CloudArrowDown,
  CircleNotch,
  ArrowsClockwise,
  HardDrive,
} from "@phosphor-icons/react";
import {
  getStoredVideoFolderPath,
  setStoredVideoFolderPath,
} from "@/lib/settings";

interface LocalFolder {
  name: string;
  path: string;
}

interface LocalFile {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedTime: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const DEFAULT_ROOT = "C:\\";

interface ExistingMatch {
  id: number;
  videoPath: string;
  videoSource: string;
}

export function LocalImportPanel({
  existingMatches,
}: {
  existingMatches: ExistingMatch[];
}) {
  const router = useRouter();

  const [defaultFolder, setDefaultFolder] = useState<string>("");
  const [defaultFolderInput, setDefaultFolderInput] = useState("");
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerPath, setFolderPickerPath] = useState(DEFAULT_ROOT);
  const [folderPickerFolders, setFolderPickerFolders] = useState<LocalFolder[]>([]);
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);
  const folderPickerRef = useRef<HTMLDivElement>(null);

  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [browseStack, setBrowseStack] = useState<{ name: string; path: string }[]>([]);

  const localMatchMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of existingMatches) {
      if (m.videoSource === "local") map.set(m.videoPath, m.id);
    }
    return map;
  }, [existingMatches]);

  const existingLocalPaths = useMemo(
    () => new Set(localMatchMap.keys()),
    [localMatchMap],
  );

  const initCheckedFromExisting = useCallback(
    (localFiles: LocalFile[]) => {
      const initial = new Set<string>();
      for (const f of localFiles) {
        if (existingLocalPaths.has(f.relativePath)) initial.add(f.relativePath);
      }
      setCheckedPaths(initial);
    },
    [existingLocalPaths],
  );

  useEffect(() => {
    const stored = getStoredVideoFolderPath();
    if (stored) {
      setDefaultFolder(stored);
      setDefaultFolderInput(stored);
    }
  }, []);

  const browseDir = useCallback(
    async (dir: string, root?: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ dir });
        if (root) params.set("root", root);
        const res = await fetch(`/api/local/browse?${params}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Failed to browse directory");
          setFolders([]);
          setFiles([]);
          return;
        }
        const data = await res.json();
        setFolders(data.folders ?? []);
        const loaded = (data.files ?? []) as LocalFile[];
        setFiles(loaded);
        initCheckedFromExisting(loaded);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [initCheckedFromExisting],
  );

  const currentBrowseDir = useMemo(() => {
    if (browseStack.length > 0) return browseStack[browseStack.length - 1].path;
    return defaultFolder || "";
  }, [browseStack, defaultFolder]);

  useEffect(() => {
    if (currentBrowseDir) {
      browseDir(currentBrowseDir, defaultFolder || undefined);
    }
  }, [currentBrowseDir, defaultFolder, browseDir]);

  // Folder picker loading
  const loadFolderPickerContents = useCallback(async (dir: string) => {
    setFolderPickerLoading(true);
    try {
      const res = await fetch(`/api/local/browse?dir=${encodeURIComponent(dir)}`);
      if (res.ok) {
        const data = await res.json();
        setFolderPickerFolders(data.folders ?? []);
      }
    } catch {
      // ignore
    } finally {
      setFolderPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showFolderPicker) {
      loadFolderPickerContents(folderPickerPath);
    }
  }, [showFolderPicker, folderPickerPath, loadFolderPickerContents]);

  useEffect(() => {
    if (!showFolderPicker) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        folderPickerRef.current &&
        !folderPickerRef.current.contains(e.target as Node)
      ) {
        setShowFolderPicker(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showFolderPicker]);

  const filteredFiles = useMemo(
    () =>
      search
        ? files.filter((f) =>
            f.name.toLowerCase().includes(search.toLowerCase()),
          )
        : files,
    [files, search],
  );

  function toggleFile(relPath: string) {
    setCheckedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }

  function toggleAll() {
    const allChecked =
      filteredFiles.length > 0 &&
      filteredFiles.every((f) => checkedPaths.has(f.relativePath));
    if (allChecked) {
      setCheckedPaths((prev) => {
        const next = new Set(prev);
        for (const f of filteredFiles) next.delete(f.relativePath);
        return next;
      });
    } else {
      setCheckedPaths((prev) => {
        const next = new Set(prev);
        for (const f of filteredFiles) next.add(f.relativePath);
        return next;
      });
    }
  }

  const toAdd = useMemo(
    () =>
      files.filter(
        (f) =>
          checkedPaths.has(f.relativePath) &&
          !existingLocalPaths.has(f.relativePath),
      ),
    [files, checkedPaths, existingLocalPaths],
  );
  const toRemove = useMemo(
    () =>
      files.filter(
        (f) =>
          !checkedPaths.has(f.relativePath) &&
          existingLocalPaths.has(f.relativePath),
      ),
    [files, checkedPaths, existingLocalPaths],
  );
  const hasChanges = toAdd.length > 0 || toRemove.length > 0;

  async function handleSync() {
    if (!hasChanges) return;
    setSyncing(true);
    setSyncMessage("");
    let added = 0;
    let removed = 0;
    let failed = 0;

    for (const file of toAdd) {
      const date = file.modifiedTime ? file.modifiedTime.slice(0, 10) : undefined;
      try {
        const res = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: file.name.replace(/\.[^.]+$/, ""),
            videoPath: file.relativePath,
            videoSource: "local",
            date,
          }),
        });
        if (res.ok) added++;
        else failed++;
      } catch {
        failed++;
      }
    }

    for (const file of toRemove) {
      const matchId = localMatchMap.get(file.relativePath);
      if (!matchId) {
        failed++;
        continue;
      }
      try {
        const res = await fetch(`/api/matches/${matchId}`, {
          method: "DELETE",
        });
        if (res.ok) removed++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setSyncing(false);
    const parts: string[] = [];
    if (added > 0) parts.push(`${added} added`);
    if (removed > 0) parts.push(`${removed} removed`);
    if (failed > 0) parts.push(`${failed} failed`);
    setSyncMessage(parts.join(", ") + ".");
    router.refresh();
  }

  const allFilteredChecked =
    filteredFiles.length > 0 &&
    filteredFiles.every((f) => checkedPaths.has(f.relativePath));

  const actionLabel = useMemo(() => {
    if (syncing) return "Syncing…";
    const parts: string[] = [];
    if (toAdd.length > 0) parts.push(`add ${toAdd.length}`);
    if (toRemove.length > 0) parts.push(`remove ${toRemove.length}`);
    if (parts.length === 0) return "No changes";
    return "Sync: " + parts.join(", ");
  }, [syncing, toAdd, toRemove]);

  function handleSetDefaultFolder(folderPath: string) {
    setDefaultFolder(folderPath);
    setDefaultFolderInput(folderPath);
    setStoredVideoFolderPath(folderPath);
    setBrowseStack([]);
    setShowFolderPicker(false);
  }

  function handleManualPathSubmit() {
    const trimmed = defaultFolderInput.trim();
    if (trimmed) {
      handleSetDefaultFolder(trimmed);
    }
  }

  const folderPickerParent = useMemo(() => {
    const parts = folderPickerPath.replace(/\\/g, "/").replace(/\/$/, "").split("/");
    if (parts.length <= 1) return null;
    parts.pop();
    let parent = parts.join("/");
    if (!parent.includes("/")) parent += "/";
    return parent;
  }, [folderPickerPath]);

  return (
    <div>
      {/* Default folder selector */}
      <div className="mb-3 flex items-center gap-2">
        <div ref={folderPickerRef} className="relative flex-1">
          <div className="flex gap-1">
            <input
              type="text"
              value={defaultFolderInput}
              onChange={(e) => setDefaultFolderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualPathSubmit();
              }}
              placeholder="Enter folder path, e.g. C:\Videos\badminton"
              className="flex-1 rounded-lg bg-ui-elevated px-3 py-1.5 text-xs text-text-main placeholder:text-text-soft/50 focus:outline-none focus:ring-1 focus:ring-ui-elevated-more"
            />
            <button
              type="button"
              onClick={handleManualPathSubmit}
              className="rounded-lg bg-ui-elevated px-2.5 py-1.5 text-xs text-text-soft hover:bg-ui-elevated-more hover:text-text-main transition-colors"
            >
              Go
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFolderPicker((p) => !p);
                setFolderPickerPath(defaultFolder || DEFAULT_ROOT);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-ui-elevated px-2.5 py-1.5 text-xs text-text-main hover:bg-ui-elevated-more transition-colors"
            >
              <Folder size={12} className="text-text-soft" weight="fill" />
              Browse
              <CaretDown
                size={10}
                className={`text-text-soft transition-transform ${showFolderPicker ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {showFolderPicker && (
            <div className="filter-dropdown-panel absolute left-0 right-0 top-full mt-1.5 z-50">
              <div className="flex items-center gap-2 border-b border-ui-elevated-more px-3 py-2">
                {folderPickerParent && (
                  <button
                    type="button"
                    onClick={() => setFolderPickerPath(folderPickerParent)}
                    className="text-text-soft hover:text-text-main"
                  >
                    <ArrowLeft size={12} />
                  </button>
                )}
                <span className="text-xs text-text-soft truncate flex-1">
                  {folderPickerPath}
                </span>
              </div>

              <ul className="max-h-48 overflow-y-auto p-1.5 space-y-px">
                {/* Select current folder as default */}
                <li>
                  <button
                    type="button"
                    onClick={() => handleSetDefaultFolder(folderPickerPath)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      defaultFolder === folderPickerPath
                        ? "text-text-main"
                        : "text-accent hover:bg-ui-elevated-more"
                    }`}
                  >
                    <Check size={10} weight="bold" />
                    Use this folder
                  </button>
                </li>

                {folderPickerLoading ? (
                  <li className="flex items-center justify-center py-4 text-xs text-text-soft">
                    <CircleNotch size={14} className="animate-spin" />
                  </li>
                ) : folderPickerFolders.length === 0 ? (
                  <li className="px-2.5 py-2 text-xs text-text-soft">
                    No subfolders
                  </li>
                ) : (
                  folderPickerFolders.map((folder) => (
                    <li key={folder.path} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSetDefaultFolder(folder.path)}
                        className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                          defaultFolder === folder.path
                            ? "text-text-main"
                            : "text-text-soft hover:bg-ui-elevated-more"
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                            defaultFolder === folder.path
                              ? "bg-accent"
                              : "bg-ui-elevated"
                          }`}
                        >
                          {defaultFolder === folder.path && (
                            <Check
                              size={10}
                              className="text-ui-bg"
                              weight="bold"
                            />
                          )}
                        </span>
                        <Folder
                          size={12}
                          className="shrink-0"
                          weight="fill"
                        />
                        <span className="truncate">{folder.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFolderPickerPath(folder.path)}
                        className="shrink-0 rounded p-1 text-text-soft hover:text-text-main hover:bg-ui-elevated-more"
                      >
                        <CaretRight size={10} />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {!defaultFolder && (
        <div className="flex flex-col items-center gap-2 py-8 text-text-soft">
          <HardDrive size={24} />
          <span className="text-xs">
            Enter a folder path or browse to pick a default video folder.
          </span>
        </div>
      )}

      {defaultFolder && (
        <>
          {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

          {/* Breadcrumb */}
          {browseStack.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBrowseStack([])}
                className="text-xs text-text-soft hover:text-text-main truncate max-w-[120px]"
              >
                {defaultFolder.split(/[\\/]/).pop() || defaultFolder}
              </button>
              {browseStack.map((f, i) => (
                <span
                  key={f.path}
                  className="flex items-center gap-1 text-xs text-text-soft"
                >
                  <CaretRight size={8} />
                  <button
                    type="button"
                    onClick={() => setBrowseStack((s) => s.slice(0, i + 1))}
                    className="hover:text-text-main truncate max-w-[120px]"
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search filter */}
          <div className="relative mb-2">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-soft"
            />
            <input
              type="text"
              placeholder="Filter videos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-ui-elevated-more bg-ui-elevated pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
            />
          </div>

          {/* File list */}
          <div className="max-h-[280px] overflow-y-auto rounded-lg border border-ui-elevated-more">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-xs text-text-soft gap-2">
                <CircleNotch size={14} className="animate-spin" />
                Loading…
              </div>
            ) : (
              <ul className="p-1.5 space-y-px">
                {folders.map((folder) => (
                  <li key={folder.path}>
                    <button
                      type="button"
                      onClick={() =>
                        setBrowseStack((s) => [
                          ...s,
                          { name: folder.name, path: folder.path },
                        ])
                      }
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-text-soft hover:bg-ui-elevated-more transition-colors"
                    >
                      <Folder
                        size={14}
                        className="shrink-0"
                        weight="fill"
                      />
                      <span className="truncate text-text-main">
                        {folder.name}
                      </span>
                      <CaretRight size={10} className="ml-auto shrink-0" />
                    </button>
                  </li>
                ))}

                {filteredFiles.length > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        allFilteredChecked
                          ? "text-text-main"
                          : "text-text-soft hover:bg-ui-elevated-more"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                          allFilteredChecked ? "bg-accent" : "bg-ui-elevated"
                        }`}
                      >
                        {allFilteredChecked && (
                          <Check
                            size={10}
                            className="text-ui-bg"
                            weight="bold"
                          />
                        )}
                      </span>
                      Select all ({filteredFiles.length})
                    </button>
                  </li>
                )}

                {filteredFiles.map((file) => {
                  const checked = checkedPaths.has(file.relativePath);
                  const isExisting = existingLocalPaths.has(file.relativePath);
                  return (
                    <li key={file.relativePath}>
                      <button
                        type="button"
                        onClick={() => toggleFile(file.relativePath)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                          checked
                            ? "text-text-main"
                            : "text-text-soft hover:bg-ui-elevated-more"
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                            checked ? "bg-accent" : "bg-ui-elevated"
                          }`}
                        >
                          {checked && (
                            <Check
                              size={10}
                              className="text-ui-bg"
                              weight="bold"
                            />
                          )}
                        </span>
                        <span className="truncate">{file.name}</span>
                        {isExisting && !checked && (
                          <span className="shrink-0 text-[10px] text-ui-error">
                            will remove
                          </span>
                        )}
                        {!isExisting && checked && (
                          <span className="shrink-0 text-[10px] text-ui-success">
                            will add
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[10px] text-text-soft">
                          {formatFileSize(file.size)}
                        </span>
                      </button>
                    </li>
                  );
                })}

                {filteredFiles.length === 0 && folders.length === 0 && (
                  <li className="flex flex-col items-center justify-center gap-1 py-8 text-text-soft">
                    <CloudArrowDown size={24} />
                    <span className="text-xs">No video files found</span>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Sync button */}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={!hasChanges || syncing}
              onClick={handleSync}
              className="flex items-center gap-1.5 rounded-lg bg-ui-elevated-more px-4 py-2 text-xs font-medium text-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {syncing ? (
                <CircleNotch size={12} className="animate-spin" />
              ) : (
                <ArrowsClockwise size={12} weight="bold" />
              )}
              {actionLabel}
            </button>
            {syncMessage && (
              <p className="text-xs text-text-soft">{syncMessage}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
