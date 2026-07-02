"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  customer_name: string;
  customer_phone: string;
  class_type: string | null;
  reservation_date: string;
  reservation_time: string;
  number_of_people: number;
  status: "pending" | "confirmed" | "cancelled" | "no_show" | "converted";
  is_converted: boolean;
};

export default function NaverReservationsPage() {
  const [tab, setTab] = useState("pending");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReservations = async (status = tab) => {
    const res = await authFetch(`/api/naver-reservations?status=${status}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "예약 목록을 불러오지 못했습니다.");
      return;
    }
    setReservations(json.reservations ?? []);
  };

  useEffect(() => {
    void loadReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const stats = useMemo(() => {
    const pendingCount = reservations.filter((item) => item.status === "pending").length;
    const confirmedCount = reservations.filter((item) => item.status === "confirmed").length;
    const convertedCount = reservations.filter((item) => item.status === "converted").length;
    return { pendingCount, confirmedCount, convertedCount, totalCount: reservations.length };
  }, [reservations]);

  const confirmReservation = async (id: string) => {
    const res = await authFetch(`/api/naver-reservations/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "확정 처리 실패");
      return;
    }
    setMessage("예약이 확정되었습니다.");
    loadReservations();
  };

  const convertReservation = async (id: string) => {
    const grade = window.prompt("학년을 입력하세요 (예: 초3)", "초3");
    if (!grade) return;
    const monthlyFeeText = window.prompt("월 수강료를 입력하세요", "350000");
    if (!monthlyFeeText) return;
    const monthlyFee = Number(monthlyFeeText);

    const res = await authFetch(`/api/naver-reservations/${id}/convert-to-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade, monthlyFee }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "회원 전환 실패");
      return;
    }
    setMessage("회원 전환이 완료되었습니다.");
    loadReservations();
  };

  const cancelReservation = async (id: string) => {
    const reason = window.prompt("취소 사유를 입력하세요");
    if (!reason) return;
    const res = await authFetch(`/api/naver-reservations/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "취소 처리 실패");
      return;
    }
    setMessage("예약이 취소되었습니다.");
    loadReservations();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">네이버 플레이스 예약 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="대기 중" value={stats.pendingCount} />
        <StatCard label="확정됨" value={stats.confirmedCount} />
        <StatCard label="회원 전환" value={stats.convertedCount} />
        <StatCard label="현재 목록" value={stats.totalCount} />
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          ["pending", "확인 대기"],
          ["confirmed", "확정됨"],
          ["converted", "회원 전환"],
          ["cancelled", "취소됨"],
          ["all", "전체"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded border px-3 py-1.5 text-sm ${
              tab === value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </section>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>예약자</Th>
              <Th>연락처</Th>
              <Th>예약 클래스</Th>
              <Th>예약 날짜</Th>
              <Th>예약 시간</Th>
              <Th>인원</Th>
              <Th>상태</Th>
              <Th>액션</Th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((row) => (
              <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <Td>{row.customer_name}</Td>
                <Td>{row.customer_phone}</Td>
                <Td>{row.class_type ?? "-"}</Td>
                <Td>{row.reservation_date}</Td>
                <Td>{row.reservation_time.slice(0, 5)}</Td>
                <Td>{row.number_of_people}명</Td>
                <Td>{statusText(row.status)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() => confirmReservation(row.id)}
                      disabled={row.status !== "pending"}
                    >
                      확정
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() => convertReservation(row.id)}
                      disabled={row.status === "cancelled" || row.status === "converted"}
                    >
                      회원등록
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() => cancelReservation(row.id)}
                      disabled={row.status === "cancelled"}
                    >
                      취소
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function statusText(status: Reservation["status"]) {
  if (status === "pending") return "대기중";
  if (status === "confirmed") return "확정";
  if (status === "converted") return "회원전환";
  if (status === "cancelled") return "취소";
  return "노쇼";
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
