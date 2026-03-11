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
} from "@phosphor-icons/react";

interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  createdTime: string;
  durationMs: number | null;
}

interface GDriveFolder {
  id: string;
  name: string;
}

function formatFileSize(bytes: string): string {
  const n = Number(bytes);
  if (n === 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface ExistingMatch {
  id: number;
  videoPath: string;
  videoSource: string;
}

export function GDriveImportPanel({ existingMatches }: { existingMatches: ExistingMatch[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [folders, setFolders] = useState<GDriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [defaultFolder, setDefaultFolder] = useState<{ id: string; name: string } | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerStack, setFolderPickerStack] = useState<{ id: string; name: string }[]>([]);
  const [folderPickerFolders, setFolderPickerFolders] = useState<GDriveFolder[]>([]);
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);
  const folderPickerRef = useRef<HTMLDivElement>(null);

  // Unified checklist: tracks which Drive file IDs should be in the library
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Map Drive file ID -> match ID for existing imports
  const gdriveMatchMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of existingMatches) {
      if (m.videoSource === "gdrive") map.set(m.videoPath, m.id);
    }
    return map;
  }, [existingMatches]);

  const existingGDriveIds = useMemo(
    () => new Set(gdriveMatchMap.keys()),
    [gdriveMatchMap]
  );

  // Initialize checked state from existing matches whenever files load
  const initCheckedFromExisting = useCallback((driveFiles: GDriveFile[]) => {
    const initial = new Set<string>();
    for (const f of driveFiles) {
      if (existingGDriveIds.has(f.id)) initial.add(f.id);
    }
    setCheckedIds(initial);
  }, [existingGDriveIds]);

  const loadVideos = useCallback(async (folderId?: string) => {
    setLoading(true);
    setError("");
    try {
      const param = folderId ? `?folderId=${folderId}` : "";
      const res = await fetch(`/api/gdrive/files${param}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load videos");
        return;
      }
      const data = await res.json();
      const loadedFiles = data.files ?? [];
      setFiles(loadedFiles);
      initCheckedFromExisting(loadedFiles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [initCheckedFromExisting]);

  const loadFoldersForBrowse = useCallback(async (folderId?: string) => {
    setLoading(true);
    try {
      const param = folderId ? `?parentId=${folderId}` : "";
      const [fRes, vRes] = await Promise.all([
        fetch(`/api/gdrive/folders${param}`),
        fetch(`/api/gdrive/files${param ? `?folderId=${folderId}` : ""}`),
      ]);
      if (fRes.ok) {
        const data = await fRes.json();
        setFolders(data.folders ?? []);
      }
      if (vRes.ok) {
        const data = await vRes.json();
        const loadedFiles = data.files ?? [];
        setFiles(loadedFiles);
        initCheckedFromExisting(loadedFiles);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [initCheckedFromExisting]);

  useEffect(() => {
    if (defaultFolder) {
      loadVideos(defaultFolder.id);
    } else {
      loadFoldersForBrowse();
    }
  }, [defaultFolder, loadVideos, loadFoldersForBrowse]);

  // Folder picker
  const folderPickerCurrentId = folderPickerStack.length > 0
    ? folderPickerStack[folderPickerStack.length - 1].id
    : undefined;

  const loadFolderPickerContents = useCallback(async (parentId?: string) => {
    setFolderPickerLoading(true);
    try {
      const param = parentId ? `?parentId=${parentId}` : "";
      const res = await fetch(`/api/gdrive/folders${param}`);
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
      loadFolderPickerContents(folderPickerCurrentId);
    }
  }, [showFolderPicker, folderPickerCurrentId, loadFolderPickerContents]);

  useEffect(() => {
    if (!showFolderPicker) return;
    function handleMouseDown(e: MouseEvent) {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setShowFolderPicker(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showFolderPicker]);

  const filteredFiles = useMemo(
    () => search
      ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
      : files,
    [files, search]
  );

  function toggleFile(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allChecked = filteredFiles.length > 0 && filteredFiles.every((f) => checkedIds.has(f.id));
    if (allChecked) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const f of filteredFiles) next.delete(f.id);
        return next;
      });
    } else {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const f of filteredFiles) next.add(f.id);
        return next;
      });
    }
  }

  // Compute diff: what needs to be added vs removed
  const toAdd = useMemo(
    () => files.filter((f) => checkedIds.has(f.id) && !existingGDriveIds.has(f.id)),
    [files, checkedIds, existingGDriveIds]
  );
  const toRemove = useMemo(
    () => files.filter((f) => !checkedIds.has(f.id) && existingGDriveIds.has(f.id)),
    [files, checkedIds, existingGDriveIds]
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
      const durationSeconds = file.durationMs != null
        ? Math.round(file.durationMs / 1000)
        : undefined;
      const date = file.createdTime ? file.createdTime.slice(0, 10) : undefined;
      try {
        const res = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: file.name.replace(/\.[^.]+$/, ""),
            videoPath: file.id,
            videoSource: "gdrive",
            durationSeconds,
            date,
          }),
        });
        if (res.ok) {
          added++;
          const data = await res.json();
          fetch(`/api/thumbnail?source=gdrive&video=${encodeURIComponent(file.id)}`).catch(() => {});
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    for (const file of toRemove) {
      const matchId = gdriveMatchMap.get(file.id);
      if (!matchId) { failed++; continue; }
      try {
        const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
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

  const allFilteredChecked = filteredFiles.length > 0 && filteredFiles.every((f) => checkedIds.has(f.id));

  // Browse mode
  const [browseStack, setBrowseStack] = useState<{ id: string; name: string }[]>([]);
  const browseCurrentId = browseStack.length > 0 ? browseStack[browseStack.length - 1].id : undefined;

  useEffect(() => {
    if (!defaultFolder) {
      loadFoldersForBrowse(browseCurrentId);
    }
  }, [browseCurrentId, defaultFolder, loadFoldersForBrowse]);

  // Action button label
  const actionLabel = useMemo(() => {
    if (syncing) return "Syncing…";
    const parts: string[] = [];
    if (toAdd.length > 0) parts.push(`add ${toAdd.length}`);
    if (toRemove.length > 0) parts.push(`remove ${toRemove.length}`);
    if (parts.length === 0) return "No changes";
    return "Sync: " + parts.join(", ");
  }, [syncing, toAdd, toRemove]);

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-3">
        <div ref={folderPickerRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setShowFolderPicker((p) => !p);
              setFolderPickerStack([]);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-ui-elevated px-3 py-1.5 text-xs text-text-main hover:bg-ui-elevated-more transition-colors"
          >
            <Folder size={12} className="text-text-soft" weight="fill" />
            <span className="max-w-[160px] truncate">
              {defaultFolder ? defaultFolder.name : "All folders"}
            </span>
            <CaretDown size={10} className={`text-text-soft transition-transform ${showFolderPicker ? "rotate-180" : ""}`} />
          </button>

          {showFolderPicker && (
            <div className="filter-dropdown-panel absolute right-0 top-full mt-1.5 z-50 min-w-[220px]">
              <div className="flex items-center gap-2 border-b border-ui-elevated-more px-3 py-2">
                {folderPickerStack.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFolderPickerStack((s) => s.slice(0, -1))}
                    className="text-text-soft hover:text-text-main"
                  >
                    <ArrowLeft size={12} />
                  </button>
                )}
                <span className="text-xs text-text-soft truncate flex-1">
                  {folderPickerStack.length > 0
                    ? folderPickerStack[folderPickerStack.length - 1].name
                    : "My Drive"}
                </span>
              </div>

              <ul className="max-h-48 overflow-y-auto p-1.5 space-y-px">
                {folderPickerStack.length === 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultFolder(null);
                        setBrowseStack([]);
                        setShowFolderPicker(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                        !defaultFolder ? "text-text-main" : "text-text-soft hover:bg-ui-elevated-more"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                          !defaultFolder ? "bg-accent" : "bg-ui-elevated"
                        }`}
                      >
                        {!defaultFolder && <Check size={10} className="text-ui-bg" weight="bold" />}
                      </span>
                      All folders
                    </button>
                  </li>
                )}

                {folderPickerLoading ? (
                  <li className="flex items-center justify-center py-4 text-xs text-text-soft">
                    <CircleNotch size={14} className="animate-spin" />
                  </li>
                ) : folderPickerFolders.length === 0 ? (
                  <li className="px-2.5 py-2 text-xs text-text-soft">No subfolders</li>
                ) : (
                  folderPickerFolders.map((folder) => (
                    <li key={folder.id} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setDefaultFolder(folder);
                          setBrowseStack([]);
                          setShowFolderPicker(false);
                        }}
                        className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                          defaultFolder?.id === folder.id
                            ? "text-text-main"
                            : "text-text-soft hover:bg-ui-elevated-more"
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                            defaultFolder?.id === folder.id ? "bg-accent" : "bg-ui-elevated"
                          }`}
                        >
                          {defaultFolder?.id === folder.id && <Check size={10} className="text-ui-bg" weight="bold" />}
                        </span>
                        <Folder size={12} className="shrink-0" weight="fill" />
                        <span className="truncate">{folder.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFolderPickerStack((s) => [...s, folder])}
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

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      {!defaultFolder && browseStack.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => setBrowseStack([])}
            className="text-xs text-text-soft hover:text-text-main"
          >
            My Drive
          </button>
          {browseStack.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1 text-xs text-text-soft">
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

      <div className="relative mb-2">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-soft" />
        <input
          type="text"
          placeholder="Filter videos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-ui-elevated-more bg-ui-elevated pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
        />
      </div>

      <div className="max-h-[280px] overflow-y-auto rounded-lg border border-ui-elevated-more">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-text-soft gap-2">
            <CircleNotch size={14} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <ul className="p-1.5 space-y-px">
            {!defaultFolder && folders.map((folder) => (
              <li key={`folder-${folder.id}`}>
                <button
                  type="button"
                  onClick={() => setBrowseStack((s) => [...s, folder])}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-text-soft hover:bg-ui-elevated-more transition-colors"
                >
                  <Folder size={14} className="shrink-0" weight="fill" />
                  <span className="truncate text-text-main">{folder.name}</span>
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
                    allFilteredChecked ? "text-text-main" : "text-text-soft hover:bg-ui-elevated-more"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                      allFilteredChecked ? "bg-accent" : "bg-ui-elevated"
                    }`}
                  >
                    {allFilteredChecked && <Check size={10} className="text-ui-bg" weight="bold" />}
                  </span>
                  Select all ({filteredFiles.length})
                </button>
              </li>
            )}

            {filteredFiles.map((file) => {
              const checked = checkedIds.has(file.id);
              const isExisting = existingGDriveIds.has(file.id);
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => toggleFile(file.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                      checked ? "text-text-main" : "text-text-soft hover:bg-ui-elevated-more"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                        checked ? "bg-accent" : "bg-ui-elevated"
                      }`}
                    >
                      {checked && <Check size={10} className="text-ui-bg" weight="bold" />}
                    </span>
                    <span className="truncate">{file.name}</span>
                    {isExisting && !checked && (
                      <span className="shrink-0 text-[10px] text-ui-error">will remove</span>
                    )}
                    {!isExisting && checked && (
                      <span className="shrink-0 text-[10px] text-ui-success">will add</span>
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
    </div>
  );
}
