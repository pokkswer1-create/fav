"use client";

import { useCallback, useEffect, useState } from "react";

type KvaNotice = {
  id: string;
  title: string;
  link: string;
  original_date: string | null;
};

export function HomeKvaNotices() {
  const [notices, setNotices] = useState<KvaNotice[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotices = useCallback(async () => {
    const res = await fetch("/api/notices/kva");
    const json = await res.json();
    if (res.ok) {
      setNotices(json.data ?? []);
    }
  }, []);

  const refreshNotices = useCallback(async () => {
    setLoading(true);
    await fetch("/api/notices/kva", { method: "POST" });
    await loadNotices();
    setLoading(false);
  }, [loadNotices]);

  useEffect(() => {
    const shouldRefresh = localStorage.getItem("kva-refresh-once") === "1";
    const timer = window.setTimeout(() => {
      if (shouldRefresh) {
        localStorage.removeItem("kva-refresh-once");
        void refreshNotices();
        return;
      }
      void loadNotices();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotices, refreshNotices]);

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">KVA 공지사항 (최신 5건)</h2>
        <button
          type="button"
          onClick={refreshNotices}
          disabled={loading}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-60 dark:border-zinc-700"
        >
          {loading ? "갱신 중..." : "새로고침"}
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {notices.length === 0 ? (
          <li className="opacity-70">공지사항이 없습니다.</li>
        ) : (
          notices.slice(0, 5).map((notice) => (
            <li
              key={notice.id}
              className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-2 last:border-b-0 dark:border-zinc-800"
            >
              <a
                href={notice.link}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 underline underline-offset-2"
              >
                {notice.title}
              </a>
              <span className="shrink-0 text-xs opacity-70">
                {notice.original_date
                  ? new Date(notice.original_date).toLocaleDateString("ko-KR")
                  : "-"}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
