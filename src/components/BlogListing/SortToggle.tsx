"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { SortOrder } from "@/lib/sort";

/**
 * Newest | Oldest sort toggle. Reads/writes `?sort=` URL param so the
 * choice is shareable and survives refresh. Default (no param) = newest.
 */
interface SortToggleProps {
  compact?: boolean;
}

export default function SortToggle({ compact = false }: SortToggleProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sort = (searchParams.get("sort") as SortOrder) || "newest";

  function setSort(order: SortOrder) {
    const params = new URLSearchParams(searchParams.toString());
    if (order === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", order);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5 ${
        compact ? "text-[0.7rem]" : "text-xs"
      } font-semibold`}
    >
      <button
        onClick={() => setSort("newest")}
        aria-pressed={sort === "newest"}
        className={`px-3 py-1 rounded-full cursor-pointer transition-all duration-150 active:scale-[0.98] ${
          sort === "newest"
            ? "bg-navy text-white"
            : "text-gray-500 hover:text-navy"
        }`}
      >
        Newest
      </button>
      <button
        onClick={() => setSort("oldest")}
        aria-pressed={sort === "oldest"}
        className={`px-3 py-1 rounded-full cursor-pointer transition-all duration-150 active:scale-[0.98] ${
          sort === "oldest"
            ? "bg-navy text-white"
            : "text-gray-500 hover:text-navy"
        }`}
      >
        Oldest
      </button>
    </div>
  );
}
