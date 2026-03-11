"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DotsThreeIcon,
  XIcon,
  PlusIcon,
  TagIcon,
  Trash,
  PencilSimple,
} from "@phosphor-icons/react";
import Link from "next/link";

interface MatchCardMenuProps {
  matchId: number;
  initialTags: string[];
  onOpenChange?: (open: boolean) => void;
}

export function MatchCardMenu({ matchId, initialTags, onOpenChange }: MatchCardMenuProps) {
  const router = useRouter();
  const [open, setOpenState] = useState(false);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expandLeft, setExpandLeft] = useState(false);

  const DROPDOWN_WIDTH = 240;

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceRight = typeof window !== "undefined" ? window.innerWidth - rect.right : 0;
    setExpandLeft(spaceRight < DROPDOWN_WIDTH);
  }, [open]);

  async function saveTags(nextTags: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (res.ok) {
        setTags(nextTags);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveFromLibrary() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setRemoving(false);
    }
  }

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setInput("");
      return;
    }
    const next = [...tags, trimmed];
    setInput("");
    saveTags(next);
  }

  function handleRemoveTag(tag: string) {
    saveTags(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div ref={containerRef} className="relative z-[100]">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-ui-bg/70 text-text-soft backdrop-blur-sm transition-colors hover:bg-ui-elevated hover:text-text-main"
        aria-label="Match options"
      >
        <DotsThreeIcon weight="bold" className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={`filter-dropdown-panel absolute top-full mt-1 z-[100] w-60 ${expandLeft ? "right-0" : "left-0"}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Link
            href={`/match/${matchId}/edit`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              router.push(`/match/${matchId}/edit`);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-main hover:bg-ui-elevated transition-colors rounded-t-lg"
            aria-label="Edit match"
          >
            <PencilSimple className="h-3.5 w-3.5 shrink-0" weight="bold" />
            <span>Edit match</span>
          </Link>
          <button
            type="button"
            onClick={handleRemoveFromLibrary}
            disabled={removing}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ui-error hover:bg-ui-elevated transition-colors disabled:opacity-50 rounded-t-lg"
            aria-label="Remove from library"
          >
            <Trash className="h-3.5 w-3.5 shrink-0" weight="bold" />
            <span>{removing ? "Removing…" : "Remove from library"}</span>
          </button>

          <div className="border-t border-ui-elevated-more px-3 py-2">
            <div className="mb-2 flex items-center gap-2">
              <TagIcon className="h-3.5 w-3.5 shrink-0 text-text-soft" aria-hidden />
              <span className="text-xs font-medium text-text-soft tracking-wide">
                Tags
              </span>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-ui-elevated px-2 py-0.5 text-xs text-text-main"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={saving}
                      className="text-text-soft hover:text-ui-error transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <XIcon weight="bold" className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Add a tag…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={saving}
                className="flex-1 bg-transparent text-xs text-text-main placeholder:text-text-soft outline-none"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!input.trim() || saving}
                className="flex h-5 w-5 items-center justify-center rounded bg-accent text-ui-bg transition-opacity disabled:opacity-30"
                aria-label="Add tag"
              >
                <PlusIcon weight="bold" className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
