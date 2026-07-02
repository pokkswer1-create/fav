"use client";

import { authFetch } from "@/lib/auth-fetch";
import Link from "next/link";
import { useEffect, useState } from "react";

type StudentDetail = {
  id: string;
  name: string;
  grade: string;
  phone: string;
  parent_name: string | null;
  parent_phone: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  status: string;
  enrollments: Array<{
    id: string;
    classes: { id: string; name: string; teacher_name: string; class_type: string } | null;
  }>;
  attendance_records: Array<{
    id: string;
    class_date: string;
    status: string;
    reason: string | null;
    makeup_status: string | null;
  }>;
  payments: Array<{
    id: string;
    month_key: string;
    amount_due: number;
    amount_paid: number;
    status: string;
    paid_at: string | null;
  }>;
  member_histories?: Array<{
    id: string;
    action: string;
    note: string | null;
    created_at: string;
  }>;
};

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      const { id } = await params;
      const res = await authFetch(`/api/students/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load student details.");
        return;
      }
      setStudent(json.data);
    };
    run();
  }, [params]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <p className="text-rose-500">{error}</p>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <p>불러오는 중...</p>
      </main>
    );
  }

  const attendanceTotal = student.attendance_records.length;
  const attendancePresent = student.attendance_records.filter((item) =>
    ["present", "late", "early_leave", "makeup"].includes(item.status)
  ).length;
  const attendanceRate =
    attendanceTotal > 0 ? ((attendancePresent / attendanceTotal) * 100).toFixed(1) : "0.0";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{student.name} 상세</h1>
        <Link className="text-sm underline opacity-80 hover:opacity-100" href="/students">
          회원 목록으로
        </Link>
      </div>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <p>학년: {student.grade}</p>
        <p className="mt-2 font-medium">연락처</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          <li>본인: {student.phone || "—"}</li>
          <li>부: {student.father_phone || "—"}</li>
          <li>모: {student.mother_phone || "—"}</li>
        </ul>
        <p className="mt-2">학부모 이름: {student.parent_name ?? "—"}</p>
        <p>상태: {student.status}</p>
        <p>출석률: {attendanceRate}%</p>
      </section>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="font-semibold">수강 정보</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {student.enrollments.map((enrollment) => (
            <li key={enrollment.id}>
              {enrollment.classes?.name ?? "-"} / {enrollment.classes?.teacher_name ?? "-"}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="font-semibold">결제 이력</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {student.payments.map((payment) => (
            <li key={payment.id}>
              {payment.month_key}: {payment.amount_paid.toLocaleString("ko-KR")} /{" "}
              {payment.amount_due.toLocaleString("ko-KR")}원 ({payment.status})
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="font-semibold">메모 & 히스토리</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(student.member_histories ?? []).length === 0 ? (
            <li>기록 없음</li>
          ) : (
            (student.member_histories ?? []).map((history) => (
              <li key={history.id}>
                {new Date(history.created_at).toLocaleString("ko-KR")} / {history.action} /{" "}
                {history.note ?? "-"}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
