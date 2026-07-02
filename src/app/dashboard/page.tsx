"use client";

import { authFetch } from "@/lib/auth-fetch";
import { HomeKvaNotices } from "@/components/home-kva-notices";
import { HomeTodayChecklist } from "@/components/home-today-checklist";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DashboardSummary = {
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  netProfit: number;
  memberCount: number;
  waitingMembers: number;
  thisMonthPaid: number;
  thisMonthUnpaidMembers: number;
  classStats: { classId: string; className: string; count: number }[];
  totalClasses: number;
  unpaidAmount: number;
  unpaidCount: number;
  absenceRate: number;
  makeupWaiting: number;
  monthlyData: { month: string; revenue: number; cost: number; profit: number; members: number }[];
};

export default function DashboardPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 12 }).map((_, idx) => {
      const d = new Date(base);
      d.setMonth(base.getMonth() - idx);
      const value = d.toISOString().slice(0, 7);
      return value;
    });
  }, []);

  const fallbackData = useMemo<DashboardSummary>(
    () => ({
      thisMonthRevenue: 0,
      lastMonthRevenue: 0,
      netProfit: 0,
      memberCount: 0,
      waitingMembers: 0,
      thisMonthPaid: 0,
      thisMonthUnpaidMembers: 0,
      classStats: [],
      totalClasses: 0,
      unpaidAmount: 0,
      unpaidCount: 0,
      absenceRate: 0,
      makeupWaiting: 0,
      monthlyData: monthOptions
        .slice()
        .reverse()
        .map((m) => ({ month: m, revenue: 0, cost: 0, profit: 0, members: 0 })),
    }),
    [monthOptions]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = (await Promise.race([
          authFetch(`/api/dashboard/summary?month=${month}`, { cache: "no-store" }),
          new Promise<Response>((_, reject) =>
            window.setTimeout(() => reject(new Error("dashboard-timeout")), 15000)
          ),
        ])) as Response;
        const json = (await res.json().catch(() => ({}))) as DashboardSummary & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "대시보드를 불러오지 못했습니다.");
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (cancelled) return;
        setError("대시보드 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const viewData = data ?? fallbackData;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {monthOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {loading ? <p>불러오는 중...</p> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard href="/payments" title="이번달 매출" value={formatWon(viewData.thisMonthRevenue)} />
        <KpiCard href="/payments" title="지난달 매출" value={formatWon(viewData.lastMonthRevenue)} />
        <KpiCard href="/dashboard" title="순이익" value={formatWon(viewData.netProfit)} />
        <KpiCard href="/students" title="회원수" value={`${viewData.memberCount}명`} />
        <KpiCard href="/students" title="승인 대기(휴원)" value={`${viewData.waitingMembers}명`} />
        <KpiCard href="/students" title="이번달 결제완료" value={`${viewData.thisMonthPaid}명`} />
        <KpiCard href="/students" title="이번달 미결제" value={`${viewData.thisMonthUnpaidMembers}명`} />
        <KpiCard href="/classes" title="총 수업횟수" value={`${viewData.totalClasses}회`} />
        <KpiCard href="/payments" title="미납금" value={formatWon(viewData.unpaidAmount)} />
        <KpiCard href="/attendance" title="결석률" value={`${viewData.absenceRate}%`} />
        <KpiCard href="/attendance" title="보강대기" value={`${viewData.makeupWaiting}건`} />
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-semibold">반별 인원 현황</h2>
        <div className="flex flex-wrap gap-2">
          {viewData.classStats.map((item) => (
            <Link
              key={item.classId}
              href={`/students?classId=${item.classId}`}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              {item.className} ({item.count}명)
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <HomeKvaNotices />
        <HomeTodayChecklist />
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-semibold">월별 매출/비용/순이익</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900/60">
              <tr>
                <th className="px-3 py-2 text-left">월</th>
                <th className="px-3 py-2 text-left">매출</th>
                <th className="px-3 py-2 text-left">비용</th>
                <th className="px-3 py-2 text-left">순이익</th>
                <th className="px-3 py-2 text-left">회원수</th>
              </tr>
            </thead>
            <tbody>
              {viewData.monthlyData.map((row) => (
                <tr key={row.month} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{row.month}</td>
                  <td className="px-3 py-2">{formatWon(row.revenue)}</td>
                  <td className="px-3 py-2">{formatWon(row.cost)}</td>
                  <td className="px-3 py-2">{formatWon(row.profit)}</td>
                  <td className="px-3 py-2">{row.members}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function KpiCard({ href, title, value }: { href: string; title: string; value: string }) {
  return (
    <Link href={href} className="rounded-xl border border-zinc-200 p-4 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40">
      <p className="text-sm opacity-75">{title}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Link>
  );
}

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}
