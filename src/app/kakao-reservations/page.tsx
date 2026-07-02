"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  customer_name: string;
  kakao_user_id: string;
  customer_phone: string;
  class_type: string | null;
  reservation_date: string;
  reservation_time: string;
  number_of_people: number;
  status: "pending" | "confirmed" | "cancelled" | "no_show" | "converted";
  kakao_message_id: string | null;
};

export default function KakaoReservationsPage() {
  const [tab, setTab] = useState("pending");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReservations = async (status = tab) => {
    const res = await authFetch(`/api/kakao-reservations?status=${status}`);
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
    const pending = reservations.filter((r) => r.status === "pending").length;
    const confirmed = reservations.filter((r) => r.status === "confirmed").length;
    const converted = reservations.filter((r) => r.status === "converted").length;
    return { pending, confirmed, converted, total: reservations.length };
  }, [reservations]);

  const doAction = async (url: string, body?: object, success?: string) => {
    const res = await authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "처리에 실패했습니다.");
      return;
    }
    if (success) setMessage(success);
    void loadReservations();
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">카카오채널 예약 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="대기 중" value={stats.pending} />
        <StatCard label="확정됨" value={stats.confirmed} />
        <StatCard label="회원 전환" value={stats.converted} />
        <StatCard label="전체" value={stats.total} />
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          ["pending", "확인 대기"],
          ["confirmed", "확정"],
          ["converted", "회원 전환"],
          ["cancelled", "취소"],
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
              <Th>고객명</Th>
              <Th>카카오 ID</Th>
              <Th>연락처</Th>
              <Th>수업</Th>
              <Th>날짜</Th>
              <Th>시간</Th>
              <Th>인원</Th>
              <Th>상태</Th>
              <Th>메시지</Th>
              <Th>액션</Th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((row) => (
              <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <Td>{row.customer_name}</Td>
                <Td>{row.kakao_user_id}</Td>
                <Td>{row.customer_phone}</Td>
                <Td>{row.class_type ?? "-"}</Td>
                <Td>{row.reservation_date}</Td>
                <Td>{row.reservation_time.slice(0, 5)}</Td>
                <Td>{row.number_of_people}명</Td>
                <Td>{statusText(row.status)}</Td>
                <Td>{row.kakao_message_id ?? "-"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() => doAction(`/api/kakao-reservations/${row.id}/confirm`, { notes: "" }, "예약이 확정되었습니다.")}
                      disabled={row.status !== "pending"}
                    >
                      확정
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() => {
                        const grade = window.prompt("학년 입력", "초3");
                        const monthlyFee = window.prompt("월 수강료 입력", "350000");
                        if (!grade || !monthlyFee) return;
                        void doAction(
                          `/api/kakao-reservations/${row.id}/convert-to-member`,
                          { grade, monthlyFee: Number(monthlyFee) },
                          "회원 전환이 완료되었습니다."
                        );
                      }}
                      disabled={row.status === "cancelled" || row.status === "converted"}
                    >
                      회원등록
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() => {
                        const reason = window.prompt("취소 사유 입력");
                        if (!reason) return;
                        void doAction(`/api/kakao-reservations/${row.id}/cancel`, { reason }, "예약이 취소되었습니다.");
                      }}
                      disabled={row.status === "cancelled"}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() =>
                        doAction(
                          `/api/kakao-reservations/${row.id}/send-message`,
                          { message: "예약 관련 안내 메시지입니다." },
                          "카카오 채널 메시지를 발송했습니다."
                        )
                      }
                    >
                      메시지
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
  if (status === "pending") return "대기";
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
