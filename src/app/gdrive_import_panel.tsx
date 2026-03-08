"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleDriveLogo,
  Folder,
  CaretRight,
  CaretDown,
  ArrowLeft,
  MagnifyingGlass,
  Check,
  CloudArrowDown,
  CircleNotch,
  Plus,
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
  videoPath: string;
  videoSource: string;
}

export function GDriveImportPanel({ existingMatches }: { existingMatches: ExistingMatch[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [folders, setFolders] = useState<GDriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Default folder selection
  const [defaultFolder, setDefaultFolder] = useState<{ id: string; name: string } | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerStack, setFolderPickerStack] = useState<{ id: string; name: string }[]>([]);
  const [folderPickerFolders, setFolderPickerFolders] = useState<GDriveFolder[]>([]);
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);
  const folderPickerRef = useRef<HTMLDivElement>(null);

  // Collapse state
  const [expanded, setExpanded] = useState(false);

  // Video checklist
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const existingGDriveIds = useMemo(
    () => new Set(existingMatches.filter((m) => m.videoSource === "gdrive").map((m) => m.videoPath)),
    [existingMatches]
  );

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
      setFiles(data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

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
        setFiles(data.files ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (defaultFolder) {
      loadVideos(defaultFolder.id);
    } else {
      loadFoldersForBrowse();
    }
  }, [defaultFolder, loadVideos, loadFoldersForBrowse]);

  // Folder picker: load contents when navigating
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

  const importableFiles = useMemo(
    () => files.filter((f) => !existingGDriveIds.has(f.id)),
    [files, existingGDriveIds]
  );

  const filteredFiles = useMemo(
    () => search
      ? importableFiles.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
      : importableFiles,
    [importableFiles, search]
  );

  const alreadyImported = useMemo(
    () => files.filter((f) => existingGDriveIds.has(f.id)),
    [files, existingGDriveIds]
  );

  function toggleFile(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
    }
  }

  async function handleImport() {
    if (selectedIds.size === 0) return;
    setImporting(true);
    setImportMessage("");
    let successCount = 0;
    let failCount = 0;

    const createdMatchIds: number[] = [];

    for (const fileId of selectedIds) {
      const file = files.find((f) => f.id === fileId);
      if (!file) continue;
      const durationSeconds = file.durationMs != null
        ? Math.round(file.durationMs / 1000)
        : undefined;
      const date = file.createdTime
        ? file.createdTime.slice(0, 10)
        : undefined;
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
          successCount++;
          const data = await res.json();
          if (data.id) createdMatchIds.push(data.id);
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setSelectedIds(new Set());
    setImporting(false);
    setImportMessage(
      failCount > 0
        ? `Added ${successCount} match${successCount !== 1 ? "es" : ""}. ${failCount} failed.`
        : `Added ${successCount} match${successCount !== 1 ? "es" : ""} to library.`
    );
    router.refresh();

    // Pre-cache thumbnails in background (fire-and-forget)
    for (const matchId of createdMatchIds) {
      fetch(`/api/thumbnail?id=${matchId}`).catch(() => {});
    }
    if (defaultFolder) loadVideos(defaultFolder.id);
    else loadFoldersForBrowse();
  }

  const allSelected = filteredFiles.length > 0 && selectedIds.size === filteredFiles.length;

  // Browse mode: no default folder set, show folders + files
  const [browseStack, setBrowseStack] = useState<{ id: string; name: string }[]>([]);
  const browseCurrentId = browseStack.length > 0 ? browseStack[browseStack.length - 1].id : undefined;

  useEffect(() => {
    if (!defaultFolder) {
      loadFoldersForBrowse(browseCurrentId);
    }
  }, [browseCurrentId, defaultFolder, loadFoldersForBrowse]);

  return (
    <section className="frame rounded-xl p-4">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <GoogleDriveLogo size={18} className="text-text-soft" />
          <h2 className="text-sm font-semibold text-text-main">Import from Google Drive</h2>
        </div>
        <CaretDown
          size={14}
          className={`text-text-soft transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
      <div className="mt-3">
      <div className="flex items-center justify-end gap-3 mb-3">
        {/* Default folder selector */}
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
                {/* "All folders" option at root level */}
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

      {/* Browse mode breadcrumb (when no default folder) */}
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

      {/* Search */}
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

      {/* Video checklist */}
      <div className="max-h-[280px] overflow-y-auto rounded-lg border border-ui-elevated-more">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-text-soft gap-2">
            <CircleNotch size={14} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <ul className="p-1.5 space-y-px">
            {/* Folder entries (browse mode only) */}
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

            {/* Select all */}
            {filteredFiles.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={toggleAll}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    allSelected ? "text-text-main" : "text-text-soft hover:bg-ui-elevated-more"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                      allSelected ? "bg-accent" : "bg-ui-elevated"
                    }`}
                  >
                    {allSelected && <Check size={10} className="text-ui-bg" weight="bold" />}
                  </span>
                  Select all ({filteredFiles.length})
                </button>
              </li>
            )}

            {/* Video files */}
            {filteredFiles.map((file) => {
              const checked = selectedIds.has(file.id);
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
                    <span className="ml-auto shrink-0 text-[10px] text-text-soft">
                      {formatFileSize(file.size)}
                    </span>
                  </button>
                </li>
              );
            })}

            {/* Already imported */}
            {alreadyImported.length > 0 && (
              <>
                <li className="px-2.5 pt-3 pb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-text-soft">
                    Already in library
                  </span>
                </li>
                {alreadyImported.map((file) => (
                  <li key={`imported-${file.id}`}>
                    <div className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-text-soft opacity-50">
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-accent">
                        <Check size={10} className="text-ui-bg" weight="bold" />
                      </span>
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto shrink-0 text-[10px]">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </li>
                ))}
              </>
            )}

            {filteredFiles.length === 0 && alreadyImported.length === 0 && folders.length === 0 && (
              <li className="flex flex-col items-center justify-center gap-1 py-8 text-text-soft">
                <CloudArrowDown size={24} />
                <span className="text-xs">No video files found</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Import action */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={selectedIds.size === 0 || importing}
          onClick={handleImport}
          className="flex items-center gap-1.5 rounded-lg bg-ui-elevated-more px-4 py-2 text-xs font-medium text-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {importing ? (
            <CircleNotch size={12} className="animate-spin" />
          ) : (
            <Plus size={12} weight="bold" />
          )}
          {importing
            ? "Importing…"
            : `Add ${selectedIds.size > 0 ? selectedIds.size : ""} match${selectedIds.size !== 1 ? "es" : ""}`}
        </button>
        {importMessage && (
          <p className="text-xs text-text-soft">{importMessage}</p>
        )}
      </div>
      </div>
      )}
    </section>
  );
}
