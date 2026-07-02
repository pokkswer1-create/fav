"use client";

import { authFetch } from "@/lib/auth-fetch";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;

function fmt(dt: unknown) {
  if (dt == null || dt === "") return "—";
  const s = String(dt);
  if (s.length >= 16) return s.slice(0, 16).replace("T", " ");
  return s;
}

function getSourceLabel(notes: unknown) {
  const raw = typeof notes === "string" ? notes : "";
  const m = raw.match(/\[source\]\s*([^\n\r]+)/i);
  if (!m) return "기본";
  const source = m[1].trim();
  if (source.includes("volleyballclass.com")) return "FAV";
  return source || "기본";
}

function ApplicationsTable({
  rows,
  columns,
  classNames,
}: {
  rows: Row[];
  columns: { key: string; label: string; width?: string }[];
  classNames: Record<string, string>;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">접수 내역이 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={(row.id as string) ?? i}
              className="border-b border-zinc-100 dark:border-zinc-800/80"
            >
              {columns.map((c) => {
                let v: unknown = row[c.key];
                if (c.key === "class_name") {
                  const cid =
                    (row.applied_class_id as string) || (row.makeup_class_id as string) || "";
                  v = cid ? classNames[cid] ?? cid.slice(0, 8) : "—";
                }
                return (
                  <td key={c.key} className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                    {v === null || v === undefined || v === "" ? "—" : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { id: "trial", label: "체험 수업" },
  { id: "regular", label: "정규 수업" },
  { id: "elite", label: "대표팀" },
  { id: "makeup", label: "보강" },
] as const;

export default function AdminApplicationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("trial");
  const [sourceFilter, setSourceFilter] = useState<"all" | "fav">("all");
  const [trials, setTrials] = useState<Row[]>([]);
  const [regulars, setRegulars] = useState<Row[]>([]);
  const [elites, setElites] = useState<Row[]>([]);
  const [makeups, setMakeups] = useState<Row[]>([]);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/applications");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "불러오기 실패");
        return;
      }
      setTrials(json.trials ?? []);
      setRegulars(json.regulars ?? []);
      setElites(json.elites ?? []);
      setMakeups(json.makeups ?? []);
      setClassNames(json.classNames ?? {});
      if (json.partialErrors?.length) {
        setError(`일부 데이터만 표시: ${json.partialErrors.join("; ")}`);
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trialCols = useMemo(
    () => [
      { key: "application_date", label: "접수일시" },
      { key: "source_label", label: "유입" },
      { key: "student_name", label: "수강생" },
      { key: "phone", label: "연락처" },
      { key: "parent_phone", label: "보호자" },
      { key: "school", label: "학교" },
      { key: "class_name", label: "희망 반" },
      { key: "status", label: "상태" },
      { key: "payment_status", label: "결제" },
    ],
    []
  );

  const regularCols = useMemo(
    () => [
      { key: "application_date", label: "접수일시" },
      { key: "source_label", label: "유입" },
      { key: "student_name", label: "수강생" },
      { key: "phone", label: "연락처" },
      { key: "parent_phone", label: "보호자" },
      { key: "address", label: "주소" },
      { key: "needs_shuttle", label: "셔틀" },
      { key: "class_name", label: "신청 반" },
      { key: "status", label: "상태" },
      { key: "counseling_date", label: "상담일" },
    ],
    []
  );

  const eliteCols = useMemo(
    () => [
      { key: "application_date", label: "접수일시" },
      { key: "source_label", label: "유입" },
      { key: "student_name", label: "수강생" },
      { key: "phone", label: "연락처" },
      { key: "school", label: "학교" },
      { key: "test_date", label: "테스트일" },
      { key: "test_time", label: "시간" },
      { key: "status", label: "상태" },
    ],
    []
  );

  const makeupCols = useMemo(
    () => [
      { key: "application_date", label: "접수일시" },
      { key: "source_label", label: "유입" },
      { key: "student_name", label: "수강생" },
      { key: "phone", label: "연락처" },
      { key: "parent_phone", label: "보호자" },
      { key: "preferred_date", label: "희망일" },
      { key: "preferred_time", label: "희망시간" },
      { key: "class_name", label: "보강 반" },
      { key: "status", label: "상태" },
    ],
    []
  );

  const displayRows = useMemo(() => {
    const raw =
      tab === "trial"
        ? trials
        : tab === "regular"
          ? regulars
          : tab === "elite"
            ? elites
            : makeups;
    const mapped = raw.map((r) => {
      const o = { ...r };
      if ("application_date" in o) o.application_date = fmt(o.application_date);
      if ("counseling_date" in o) o.counseling_date = fmt(o.counseling_date);
      if ("needs_shuttle" in o) o.needs_shuttle = o.needs_shuttle ? "예" : "아니오";
      o.source_label = getSourceLabel(o.notes);
      return o;
    });
    if (sourceFilter === "fav") {
      return mapped.filter((r) => String(r.source_label) === "FAV");
    }
    return mapped;
  }, [tab, trials, regulars, elites, makeups, sourceFilter]);

  const cols =
    tab === "trial"
      ? trialCols
      : tab === "regular"
        ? regularCols
        : tab === "elite"
          ? eliteCols
          : makeupCols;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
        >
          ← 대시보드
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">수업 신청</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            학부모 사이트(<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/parents</code>)에서 접수된
            체험·정규·대표팀·보강 신청 목록입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          새로고침
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === t.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t.label}
            <span className="ml-1 opacity-70">
              (
              {t.id === "trial"
                ? trials.length
                : t.id === "regular"
                  ? regulars.length
                  : t.id === "elite"
                    ? elites.length
                    : makeups.length}
              )
            </span>
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setSourceFilter("all")}
            className={`rounded-full px-3 py-1 text-sm ${
              sourceFilter === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            전체 유입
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter("fav")}
            className={`rounded-full px-3 py-1 text-sm ${
              sourceFilter === "fav"
                ? "bg-violet-600 text-white"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            FAV만 보기
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">불러오는 중…</p>
      ) : (
        <ApplicationsTable rows={displayRows} columns={cols} classNames={classNames} />
      )}
    </main>
  );
}
