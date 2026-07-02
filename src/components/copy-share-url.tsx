"use client";

import { useCallback, useState } from "react";

export function CopyShareUrl({ url, label = "주소 복사" }: { url: string; label?: string }) {
  const [done, setDone] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      window.prompt("아래 주소를 복사하세요:", url);
    }
  }, [url]);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
    >
      {done ? "복사됨 ✓" : label}
    </button>
  );
}
