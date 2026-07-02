"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useMemo, useState } from "react";

type Expense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  note: string | null;
};

export default function ExpensesPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [category, setCategory] = useState("월세");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [list, setList] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ byCategory: Record<string, number>; total: number; ratio: number; profitMargin: number } | null>(null);
  const [error, setError] = useState("");

  const categories = useMemo(() => ["월세", "보험료", "급여", "유틸리티", "통신비", "교재료", "기타"], []);

  const load = async () => {
    const [res1, res2] = await Promise.all([
      authFetch(`/api/expenses?month=${month}`),
      authFetch(`/api/expenses/summary?month=${month}`),
    ]);
    const j1 = await res1.json();
    const j2 = await res2.json();
    if (!res1.ok || !res2.ok) {
      setError(j1.error ?? j2.error ?? "지출 데이터를 불러오지 못했습니다.");
      return;
    }
    setList(j1.data);
    setSummary(j2);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const addExpense = async () => {
    const res = await authFetch("/api/expenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, amount, description, date: `${month}-01` }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "지출 추가 실패");
      return;
    }
    setList((prev) => [json.data, ...prev]);
    setAmount(0);
    setDescription("");
    void load();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">지출 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-5">
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="number"
          placeholder="금액"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="설명(선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          onClick={addExpense}
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          지출 추가
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm opacity-70">월 총 지출</p>
          <p className="mt-1 text-xl font-semibold">{(summary?.total ?? 0).toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm opacity-70">지출 비율</p>
          <p className="mt-1 text-xl font-semibold">{summary?.ratio ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm opacity-70">순이익률</p>
          <p className="mt-1 text-xl font-semibold">{summary?.profitMargin ?? 0}%</p>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2 text-left font-medium">카테고리</th>
              <th className="px-3 py-2 text-left font-medium">금액</th>
              <th className="px-3 py-2 text-left font-medium">날짜</th>
              <th className="px-3 py-2 text-left font-medium">설명</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{item.category}</td>
                <td className="px-3 py-2">{item.amount.toLocaleString("ko-KR")}원</td>
                <td className="px-3 py-2">{item.expense_date}</td>
                <td className="px-3 py-2">{item.note ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
