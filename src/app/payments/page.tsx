"use client";

import { authFetch } from "@/lib/auth-fetch";
import { mockPaymentProvider } from "@/lib/providers/payment/mock";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type StudentLite = {
  id: string;
  name: string;
  grade: string;
  parent_name: string | null;
  parent_phone: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
};

type PaymentItem = {
  id: string;
  student_id: string;
  month_key: string;
  amount_due: number;
  amount_paid: number;
  status: "paid" | "pending" | "unpaid" | "refunded";
  paid_at: string | null;
  students:
    | (StudentLite & {
        enrollments?: {
          class_id?: string;
          classes?: { id: string; name: string; teacher_name: string } | null;
        }[];
      })
    | null;
};

export default function PaymentsPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [amountDue, setAmountDue] = useState(350000);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    const paymentParams = new URLSearchParams({ month });
    if (statusFilter) paymentParams.set("status", statusFilter);
    if (classFilter) paymentParams.set("classId", classFilter);
    if (instructorFilter) paymentParams.set("instructor", instructorFilter);

    const [paymentsRes, studentsRes] = await Promise.all([
      authFetch(`/api/payments?${paymentParams.toString()}`),
      authFetch("/api/students?status=active&sort=name.asc"),
    ]);
    const paymentsJson = await paymentsRes.json();
    const studentsJson = await studentsRes.json();
    if (!paymentsRes.ok || !studentsRes.ok) {
      setError(paymentsJson.error ?? studentsJson.error ?? "Failed to load payment data.");
      return;
    }
    setPayments(paymentsJson.data);
    setStudents(studentsJson.data);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, statusFilter, classFilter, instructorFilter]);

  const upsertPayment = async () => {
    if (!selectedStudent) return;
    setError("");
    setMessage("");
    const res = await authFetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: selectedStudent,
        month_key: month,
        amount_due: amountDue,
        amount_paid: 0,
        status: "unpaid",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to create payment.");
      return;
    }
    setMessage("결제 예정 항목을 생성했습니다.");
    loadData();
  };

  const markPaid = async (item: PaymentItem) => {
    const res = await authFetch(`/api/payments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "paid",
        amount_paid: item.amount_due,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to mark as paid.");
      return;
    }
    setPayments((prev) => prev.map((payment) => (payment.id === item.id ? json.data : payment)));
  };

  const sendPaymentLink = async (item: PaymentItem) => {
    const result = await mockPaymentProvider.createPaymentLink({
      studentId: item.student_id,
      amount: item.amount_due,
      monthKey: item.month_key,
    });
    setMessage(
      `Mock 결제 링크 생성 완료 (${item.students?.name ?? "학생"}): ${result.paymentUrl}`
    );
  };

  const stats = useMemo(() => {
    const target = payments.reduce((sum, payment) => sum + payment.amount_due, 0);
    const paid = payments.reduce((sum, payment) => sum + payment.amount_paid, 0);
    return {
      target,
      paid,
      unpaid: Math.max(target - paid, 0),
      rate: target ? ((paid / target) * 100).toFixed(1) : "0.0",
    };
  }, [payments]);

  const sendBulk = async () => {
    if (checkedIds.length === 0) {
      setError("선택된 회원이 없습니다.");
      return;
    }
    const res = await authFetch("/api/payments/send-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: checkedIds, month, channel: "kakao" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "일괄 발송 실패");
      return;
    }
    setMessage(`일괄 발송 완료: 성공 ${json.sent}, 실패 ${json.failed}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">결제 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-4">
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">총 예정금액</p>
          <p className="text-lg font-semibold">{stats.target.toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">총 결제금액</p>
          <p className="text-lg font-semibold">{stats.paid.toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">미납금</p>
          <p className="text-lg font-semibold">{stats.unpaid.toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">결제율</p>
          <p className="text-lg font-semibold">{stats.rate}%</p>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-7">
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">전체 상태</option>
          <option value="paid">완료</option>
          <option value="pending">대기</option>
          <option value="unpaid">미납</option>
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="반 ID 필터"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="강사명 필터"
          value={instructorFilter}
          onChange={(e) => setInstructorFilter(e.target.value)}
        />
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
        >
          <option value="">학생 선택</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="number"
          value={amountDue}
          onChange={(e) => setAmountDue(Number(e.target.value))}
        />
        <button
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
          type="button"
          onClick={upsertPayment}
        >
          결제 예정 등록
        </button>
        <button
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
          type="button"
          onClick={sendBulk}
        >
          일괄 카카오톡 발송
        </button>
      </section>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>회원</Th>
              <Th>선택</Th>
              <Th>월</Th>
              <Th>반/강사</Th>
              <Th>예정금액</Th>
              <Th>결제금액</Th>
              <Th>상태</Th>
              <Th>액션</Th>
            </tr>
          </thead>
          <tbody>
            {payments.map((item) => (
              <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <Td>{item.students?.name ?? "-"}</Td>
                <Td>
                  <input
                    type="checkbox"
                    checked={checkedIds.includes(item.student_id)}
                    onChange={(e) =>
                      setCheckedIds((prev) =>
                        e.target.checked
                          ? [...new Set([...prev, item.student_id])]
                          : prev.filter((id) => id !== item.student_id)
                      )
                    }
                  />
                </Td>
                <Td>{item.month_key}</Td>
                <Td>
                  {item.students?.enrollments?.[0]?.classes?.name ?? "-"} /{" "}
                  {item.students?.enrollments?.[0]?.classes?.teacher_name ?? "-"}
                </Td>
                <Td>{item.amount_due.toLocaleString("ko-KR")}원</Td>
                <Td>{item.amount_paid.toLocaleString("ko-KR")}원</Td>
                <Td>{statusKorean(item.status)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
                      onClick={() => markPaid(item)}
                      disabled={item.status === "paid"}
                    >
                      완료처리
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
                      onClick={() => sendPaymentLink(item)}
                    >
                      결제링크(Mock)
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

function statusKorean(value: "paid" | "pending" | "unpaid" | "refunded") {
  if (value === "paid") return "완료";
  if (value === "pending") return "대기";
  if (value === "unpaid") return "미납";
  return "환불";
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
