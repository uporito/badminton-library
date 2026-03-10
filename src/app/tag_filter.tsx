"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TagIcon } from "@phosphor-icons/react";

interface TagFilterProps {
  allTags: string[];
}

export function TagFilter({ allTags }: TagFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTags = searchParams.get("tags")?.split(",").filter(Boolean) ?? [];

  if (allTags.length === 0) return null;

  function toggleTag(tag: string) {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];

    const sp = new URLSearchParams(searchParams.toString());
    if (next.length > 0) {
      sp.set("tags", next.join(","));
    } else {
      sp.delete("tags");
    }
    const q = sp.toString();
    router.push(q ? `/?${q}` : "/");
  }

  return (
    <div className="frame flex flex-wrap items-center gap-1 rounded-xl p-1">
      <span className="mr-1 flex items-center gap-1 self-center px-2 text-xs font-medium text-text-soft">
        <TagIcon className="h-3 w-3" aria-hidden />
        Tags
      </span>
      {allTags.map((tag) => {
        const active = activeTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              active
                ? "bg-accent text-ui-bg"
                : "text-text-soft hover:bg-ui-elevated"
            }`}
          >
            {tag}
          </button>
        );
      })}
      {activeTags.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const sp = new URLSearchParams(searchParams.toString());
            sp.delete("tags");
            const q = sp.toString();
            router.push(q ? `/?${q}` : "/");
          }}
          className="ml-1 rounded-md px-2 py-1 text-xs text-text-soft hover:text-text-main transition-colors cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}
