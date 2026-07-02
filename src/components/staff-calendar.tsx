"use client";

import { authFetch } from "@/lib/auth-fetch";
import type { CalendarEventDto } from "@/lib/calendar-types";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const MANUAL_CATEGORIES = ["체험 수업", "정규 수업", "보강", "대표팀", "상담", "기타"] as const;

function lineSummary(ev: CalendarEventDto): string {
  const parts = [ev.category];
  if (ev.studentName) parts.push(ev.studentName);
  if (ev.className) parts.push(ev.className);
  if (ev.time) parts.push(ev.time);
  return parts.join(" · ");
}

export function StaffCalendar() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<Record<string, CalendarEventDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [warn, setWarn] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [addForDate, setAddForDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setWarn("");
    try {
      const res = await authFetch(`/api/home/calendar-events?year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok) {
        setEvents({});
        if (res.status === 401) {
          setWarn("로그인 후 일정을 확인할 수 있습니다.");
        } else {
          setWarn(json.error ?? "일정을 불러오지 못했습니다.");
        }
        return;
      }
      setEvents(json.events ?? {});
      const w = [...(json.warnings ?? []), json.warning].filter(Boolean);
      if (w.length) setWarn(w.join(" "));
    } catch {
      setEvents({});
      setWarn("네트워크 오류입니다.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  const cells = useMemo(() => {
    const list: ({ type: "empty" } | { type: "day"; d: number })[] = [];
    for (let i = 0; i < firstDow; i++) list.push({ type: "empty" });
    for (let d = 1; d <= daysInMonth; d++) list.push({ type: "day", d });
    return list;
  }, [firstDow, daysInMonth]);

  function dateKey(d: number) {
    return `${year}-${pad2(month)}-${pad2(d)}`;
  }

  function prevMonth() {
    if (month <= 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelected(null);
  }

  function nextMonth() {
    if (month >= 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelected(null);
  }

  const selectedItems = selected ? events[selected] ?? [] : [];

  async function deleteManual(id: string) {
    if (!confirm("이 수동 일정을 삭제할까요?")) return;
    const res = await authFetch(`/api/home/calendar-manual?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json();
      alert(j.error ?? "삭제 실패");
      return;
    }
    void load();
    if (selected) setSelected(selected);
  }

  return (
    <section className="w-full max-w-5xl rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">달력</h1>
        <p className="max-w-xl text-xs text-zinc-500 dark:text-zinc-400">
          체험·정규·보강·대표팀 등 접수와 신규 반 등록이 날짜별로 표시됩니다. 일정 추가로 직접 등록할 수 있습니다.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
            aria-label="이전 달"
          >
            ‹
          </button>
          <span className="min-w-[8rem] text-center text-base font-semibold">
            {year}년 {month}월
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          새로고침
        </button>
      </div>

      {warn ? <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">{warn}</p> : null}
      {loading ? <p className="mb-3 text-sm text-zinc-500">불러오는 중…</p> : null}

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:text-sm"
          >
            {w}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (cell.type === "empty") {
            return <div key={`e-${idx}`} className="min-h-[100px] sm:min-h-[118px]" />;
          }
          const d = cell.d;
          const key = dateKey(d);
          const list = events[key] ?? [];
          const hasEvent = list.length > 0;
          const isToday = key === todayKey;
          const isSelected = selected === key;
          const show = list.slice(0, 4);
          const more = list.length - show.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`relative min-h-[100px] w-full rounded-lg border p-1 text-left align-top transition sm:min-h-[118px] ${
                hasEvent
                  ? "border-2 border-red-600 bg-red-50/30 dark:bg-red-950/20"
                  : "border border-zinc-200 dark:border-zinc-700"
              } ${isToday && !hasEvent ? "bg-sky-50 dark:bg-sky-950/30" : ""} ${
                isSelected ? "ring-2 ring-sky-500 ring-offset-1 dark:ring-offset-zinc-950" : ""
              } hover:bg-zinc-50 dark:hover:bg-zinc-900/80`}
            >
              <span
                className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded text-xs font-bold sm:text-sm ${
                  hasEvent ? "text-red-800 dark:text-red-200" : "text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {d}
              </span>
              <div className="mt-7 space-y-0.5 px-0.5">
                {show.map((ev) => (
                  <div
                    key={`${ev.source}-${ev.id}`}
                    className="truncate text-[10px] leading-tight text-zinc-800 dark:text-zinc-200 sm:text-[11px]"
                    title={lineSummary(ev) + (ev.note ? ` — ${ev.note}` : "")}
                  >
                    <span className="font-medium text-red-800 dark:text-red-300">{ev.category}</span>
                    {ev.studentName ? <span> {ev.studentName}</span> : null}
                    {ev.className ? (
                      <span className="text-zinc-600 dark:text-zinc-400"> · {ev.className}</span>
                    ) : null}
                    {ev.time ? (
                      <span className="text-zinc-500 dark:text-zinc-500"> {ev.time}</span>
                    ) : null}
                  </div>
                ))}
                {more > 0 ? (
                  <div className="text-[10px] font-medium text-zinc-500">+{more}건</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          {selected ? (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{selected}</p>
                <button
                  type="button"
                  onClick={() => setAddForDate(selected)}
                  className="rounded-md bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  이 날짜에 일정 추가
                </button>
              </div>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-zinc-500">등록된 일정이 없습니다.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {selectedItems.map((ev) => (
                    <li
                      key={`${ev.source}-${ev.id}`}
                      className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 pb-2 last:border-0 dark:border-zinc-700"
                    >
                      <div>
                        <p className="font-medium text-red-800 dark:text-red-300">{ev.category}</p>
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {ev.studentName ?? "—"}
                          {ev.className ? ` · ${ev.className}` : ""}
                          {ev.time ? ` · ${ev.time}` : ""}
                        </p>
                        {ev.note ? (
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{ev.note}</p>
                        ) : null}
                      </div>
                      {ev.deletable ? (
                        <button
                          type="button"
                          onClick={() => void deleteManual(ev.id)}
                          className="shrink-0 text-xs text-rose-600 underline dark:text-rose-400"
                        >
                          삭제
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-500">날짜를 선택하면 상세와 일정 추가가 가능합니다.</p>
          )}
        </div>
      </div>

      {addForDate ? (
        <AddEventModal
          date={addForDate}
          saving={saving}
          onClose={() => setAddForDate(null)}
          onSaved={async () => {
            setAddForDate(null);
            await load();
          }}
          setSaving={setSaving}
        />
      ) : null}
    </section>
  );
}

function AddEventModal({
  date,
  saving,
  onClose,
  onSaved,
  setSaving,
}: {
  date: string;
  saving: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  setSaving: (v: boolean) => void;
}) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const res = await authFetch("/api/home/calendar-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate: date,
          category: fd.get("category"),
          studentName: fd.get("studentName") || null,
          className: fd.get("className") || null,
          eventTime: fd.get("eventTime") || null,
          note: fd.get("note") || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "저장 실패");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">일정 추가 · {date}</h2>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium">유형</span>
            <select
              name="category"
              className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
              defaultValue="기타"
            >
              {MANUAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">이름</span>
            <input
              name="studentName"
              className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="수강생 또는 내용"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">반 / 장소</span>
            <input
              name="className"
              className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="반 이름 등"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">시간</span>
            <input
              name="eventTime"
              type="time"
              className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">메모</span>
            <textarea
              name="note"
              rows={2}
              className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
