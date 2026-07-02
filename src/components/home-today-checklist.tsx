"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ChecklistItem = {
  id: string;
  severity: "warning" | "info" | "success";
  title: string;
  detail?: string;
  href?: string;
};

type Payload = {
  date: string;
  monthKey: string;
  items: ChecklistItem[];
};

const borderBySeverity: Record<ChecklistItem["severity"], string> = {
  warning: "border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10",
  info: "border-l-sky-500 bg-sky-500/5 dark:bg-sky-500/10",
  success: "border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10",
};

export function HomeTodayChecklist() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      const res = await fetch("/api/home/today-checklist");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("로그인 후 오늘 할 일을 확인할 수 있습니다.");
        } else {
          setError(json.error ?? "불러오지 못했습니다.");
        }
        setData(null);
        setLoading(false);
        return;
      }
      setData(json.data as Payload);
      setLoading(false);
    };
    void run();
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">오늘 체크할 일</h2>
        {data ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            기준일 {data.date} · 정산월 {data.monthKey}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        출석 미입력, 이번 달 결제 대기, 예약·인스타 예약 등 오늘 확인하면 좋은 항목입니다.
      </p>

      {loading ? (
        <p className="mt-4 text-sm opacity-70">불러오는 중…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : data && data.items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {data.items.map((item) => {
            const inner = (
              <div
                className={`rounded-r-lg border-l-4 py-2.5 pl-3 pr-3 text-sm ${borderBySeverity[item.severity]}`}
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                {item.detail ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{item.detail}</p>
                ) : null}
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="block transition hover:opacity-90">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm opacity-70">표시할 항목이 없습니다.</p>
      )}
    </section>
  );
}
