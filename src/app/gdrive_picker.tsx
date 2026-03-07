"use client";

import { useState, useEffect, useCallback } from "react";
import { Folder, CaretRight, VideoCamera, ArrowLeft, MagnifyingGlass, CloudArrowDown } from "@phosphor-icons/react";

interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
}

interface GDriveFolder {
  id: string;
  name: string;
}

interface GDrivePickerProps {
  onSelect: (fileId: string, fileName: string) => void;
  onCancel: () => void;
}

function formatFileSize(bytes: string): string {
  const n = Number(bytes);
  if (n === 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function GDrivePicker({ onSelect, onCancel }: GDrivePickerProps) {
  const [folders, setFolders] = useState<GDriveFolder[]>([]);
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : undefined;

  const loadContents = useCallback(async (folderId?: string) => {
    setLoading(true);
    setError("");
    try {
      const folderParam = folderId ? `?parentId=${folderId}` : "";
      const fileParam = folderId ? `?folderId=${folderId}` : "";
      const [foldersRes, filesRes] = await Promise.all([
        fetch(`/api/gdrive/folders${folderParam}`),
        fetch(`/api/gdrive/files${fileParam}`),
      ]);

      if (!foldersRes.ok || !filesRes.ok) {
        const errData = await (foldersRes.ok ? filesRes : foldersRes).json().catch(() => ({}));
        setError(errData.error ?? "Failed to load Google Drive contents");
        return;
      }

      const foldersData = await foldersRes.json();
      const filesData = await filesRes.json();
      setFolders(foldersData.folders ?? []);
      setFiles(filesData.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContents(currentFolderId);
  }, [currentFolderId, loadContents]);

  function navigateIntoFolder(folder: GDriveFolder) {
    setFolderStack((prev) => [...prev, folder]);
  }

  function navigateUp() {
    setFolderStack((prev) => prev.slice(0, -1));
  }

  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  const filteredFolders = search
    ? folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : folders;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {folderStack.length > 0 && (
          <button
            type="button"
            onClick={navigateUp}
            className="rounded p-1 text-text-soft hover:bg-ui-elevated"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="flex items-center gap-1 text-xs text-text-soft overflow-hidden">
          <span className="shrink-0">My Drive</span>
          {folderStack.map((f) => (
            <span key={f.id} className="flex items-center gap-1 shrink-0">
              <CaretRight size={10} />
              <span className="truncate max-w-[120px]">{f.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-soft" />
        <input
          type="text"
          placeholder="Filter files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-ui-elevated-more bg-ui-elevated pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
        />
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <div className="max-h-[240px] overflow-y-auto rounded-md border border-ui-elevated-more">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-text-soft">
            Loading…
          </div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-text-soft">
            <CloudArrowDown size={24} />
            <span className="text-xs">No video files found</span>
          </div>
        ) : (
          <ul className="divide-y divide-ui-elevated-more">
            {filteredFolders.map((folder) => (
              <li key={folder.id}>
                <button
                  type="button"
                  onClick={() => navigateIntoFolder(folder)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-ui-elevated transition-colors"
                >
                  <Folder size={16} className="shrink-0 text-text-soft" weight="fill" />
                  <span className="truncate text-text-main">{folder.name}</span>
                  <CaretRight size={12} className="ml-auto shrink-0 text-text-soft" />
                </button>
              </li>
            ))}
            {filteredFiles.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => onSelect(file.id, file.name)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-ui-elevated transition-colors"
                >
                  <VideoCamera size={16} className="shrink-0 text-text-soft" />
                  <span className="truncate text-text-main">{file.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-text-soft">
                    {formatFileSize(file.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="self-end text-xs text-text-soft hover:text-text-main"
      >
        Cancel
      </button>
    </div>
  );
}
