"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useMemo, useState } from "react";

type Journal = {
  id: string;
  category: "class" | "counsel" | "meeting" | "other";
  content: string;
  created_at: string;
  profiles: { full_name: string } | null;
  students: { id: string; name: string } | null;
};

type StudentOption = { id: string; name: string };

export default function JournalsPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [category, setCategory] = useState<Journal["category"]>("class");
  const [content, setContent] = useState("");
  const [taggedStudentId, setTaggedStudentId] = useState("");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<{
    byCategory: Record<string, number>;
    byInstructor: Record<string, number>;
    heatmap: Record<string, number>;
  } | null>(null);

  const categoryStats = useMemo(() => {
    return journals.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [journals]);

  const loadData = async () => {
    const [journalsRes, studentsRes, statsRes] = await Promise.all([
      authFetch(`/api/journals?month=${month}`),
      authFetch("/api/students?sort=name.asc"),
      authFetch(`/api/work-log/stats?month=${month}`),
    ]);
    const journalsJson = await journalsRes.json();
    const studentsJson = await studentsRes.json();
    const statsJson = await statsRes.json();
    if (!journalsRes.ok || !studentsRes.ok || !statsRes.ok) {
      setError(journalsJson.error ?? studentsJson.error ?? statsJson.error ?? "Failed to load journals.");
      return;
    }
    setJournals(journalsJson.data);
    setStudents(studentsJson.data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    setStats(statsJson);
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const submitJournal = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const res = await authFetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        content,
        tagged_student_id: taggedStudentId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to create journal.");
      return;
    }

    setContent("");
    setTaggedStudentId("");
    setMessage("업무일지가 등록되었습니다.");
    setJournals((prev) => [json.data, ...prev]);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">업무일지</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        작성된 업무일지는 블로그 피드 형태로 쌓이며, 인스타 게시물처럼 카드로 확인할 수 있습니다.
      </p>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-5">
        <label className="text-sm">
          조회 월
          <input
            className="mt-1 w-full rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">수업</p>
          <p className="text-lg font-semibold">{categoryStats.class ?? 0}</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">상담</p>
          <p className="text-lg font-semibold">{categoryStats.counsel ?? 0}</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">회의</p>
          <p className="text-lg font-semibold">{categoryStats.meeting ?? 0}</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">기타</p>
          <p className="text-lg font-semibold">{categoryStats.other ?? 0}</p>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-semibold">카테고리 분포</h3>
          <ul className="space-y-1 text-sm">
            {Object.entries(stats?.byCategory ?? {}).map(([key, value]) => (
              <li key={key}>
                {key}: {value}건
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">강사별 건수</h3>
          <ul className="space-y-1 text-sm">
            {Object.entries(stats?.byInstructor ?? {}).map(([key, value]) => (
              <li key={key}>
                {key.slice(0, 8)}: {value}건
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">요일 히트맵(건수)</h3>
          <p className="text-sm opacity-80">
            {Object.keys(stats?.heatmap ?? {}).length} 셀 활성
          </p>
        </div>
      </section>

      <form className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-4" onSubmit={submitJournal}>
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={category}
          onChange={(e) => setCategory(e.target.value as Journal["category"])}
        >
          <option value="class">수업</option>
          <option value="counsel">학생상담</option>
          <option value="meeting">회의</option>
          <option value="other">기타</option>
        </select>
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={taggedStudentId}
          onChange={(e) => setTaggedStudentId(e.target.value)}
        >
          <option value="">학생 태그(선택)</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
        <textarea
          className="min-h-24 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 md:col-span-2"
          placeholder="업무 내용을 입력하세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <button className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900 md:col-span-4">
          업무일지 저장
        </button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {journals.length === 0 ? (
          <div className="rounded-xl border p-6 text-sm opacity-70 dark:border-zinc-800">
            등록된 업무일지가 없습니다.
          </div>
        ) : (
          journals.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="h-40 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800" />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-900">
                    {categoryLabel(item.category)}
                  </span>
                  <span className="text-xs opacity-70">
                    {new Date(item.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <h3 className="line-clamp-1 text-sm font-semibold">
                  {item.profiles?.full_name ?? "강사"} 업무일지
                </h3>
                <p className="line-clamp-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {item.content}
                </p>
                <div className="flex items-center justify-between text-xs opacity-75">
                  <span>태그: {item.students?.name ?? "없음"}</span>
                  <span>{new Date(item.created_at).toLocaleTimeString("ko-KR")}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function categoryLabel(value: Journal["category"]) {
  if (value === "class") return "수업";
  if (value === "counsel") return "학생상담";
  if (value === "meeting") return "회의";
  return "기타";
}
