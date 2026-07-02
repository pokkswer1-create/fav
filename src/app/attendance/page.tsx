"use client";

import type { AttendanceStatus } from "@/lib/types";
import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

type StudentOption = { id: string; name: string };
type ClassOption = {
  id: string;
  name: string;
  enrollments?: { student_id: string; students?: { id: string; name: string } | null }[];
};
type AttendanceItem = {
  id: string;
  class_date: string;
  status: AttendanceStatus;
  reason: string | null;
  makeup_status: string | null;
  students: StudentOption | null;
  classes: ClassOption | null;
};

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classDate, setClassDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bulkStatuses, setBulkStatuses] = useState<Record<string, AttendanceStatus>>({});

  const filteredStudents = useMemo(() => students, [students]);

  const loadData = async () => {
    const [classesRes, studentsRes, recordsRes] = await Promise.all([
      authFetch("/api/classes"),
      authFetch("/api/students?status=active&sort=name.asc"),
      authFetch(`/api/attendance?month=${month}`),
    ]);
    const classesJson = await classesRes.json();
    const studentsJson = await studentsRes.json();
    const recordsJson = await recordsRes.json();

    if (!classesRes.ok || !studentsRes.ok || !recordsRes.ok) {
      setError(classesJson.error ?? studentsJson.error ?? recordsJson.error ?? "Failed to load.");
      return;
    }
    setClasses(
      classesJson.data.map(
        (item: {
          id: string;
          name: string;
          enrollments?: {
            student_id: string;
            students?: { id: string; name: string } | null;
          }[];
        }) => ({
          id: item.id,
          name: item.name,
          enrollments: item.enrollments ?? [],
        })
      )
    );
    setStudents(studentsJson.data.map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })));
    setRecords(recordsJson.data);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const saveAttendance = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await authFetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: classId,
        student_id: studentId,
        class_date: classDate,
        status,
        reason: reason || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to record attendance.");
      return;
    }
    await loadData();
    if (status === "absent") {
      setReason("");
    }
  };

  const selectedClass = classes.find((klass) => klass.id === classId);
  const classStudents =
    selectedClass?.enrollments
      ?.map((enroll) =>
        enroll.students ? { id: enroll.students.id, name: enroll.students.name } : null
      )
      .filter((v): v is StudentOption => Boolean(v)) ?? [];

  const saveBulkAttendance = async () => {
    if (!classId || classStudents.length === 0) return;
    const attendanceList = classStudents.map((student) => ({
      memberId: student.id,
      status: bulkStatuses[student.id] ?? "present",
    }));
    const res = await authFetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        date: classDate,
        attendanceList,
        instructorId: "bulk-instructor",
        loggedAt: new Date().toISOString(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "일괄 출석 저장 실패");
      return;
    }
    await loadData();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">출석 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}

      <form className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-3" onSubmit={saveAttendance}>
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          required
        >
          <option value="">수업 선택</option>
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        >
          <option value="">학생 선택</option>
          {filteredStudents.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="date"
          value={classDate}
          onChange={(e) => setClassDate(e.target.value)}
          required
        />
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={status}
          onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
        >
          <option value="present">출석</option>
          <option value="absent">결석</option>
          <option value="late">지각</option>
          <option value="early_leave">조퇴</option>
          <option value="makeup">보강</option>
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 md:col-span-2"
          placeholder="결석/특이사항 메모"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900 md:col-span-3"
        >
          출석 저장
        </button>
      </form>

      {classId ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h2 className="mb-2 font-semibold">수업별 출석 일괄 입력</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {classStudents.map((student) => (
              <div
                key={student.id}
                className="flex min-w-0 items-center gap-2 rounded border border-zinc-200 px-3 py-2 dark:border-zinc-700"
              >
                <span className="min-w-0 flex-1 truncate font-medium" title={student.name}>
                  {student.name}
                </span>
                <select
                  className="shrink-0 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                  value={bulkStatuses[student.id] ?? "present"}
                  onChange={(e) =>
                    setBulkStatuses((prev) => ({
                      ...prev,
                      [student.id]: e.target.value as AttendanceStatus,
                    }))
                  }
                >
                  <option value="present">출석</option>
                  <option value="absent">결석</option>
                  <option value="late">지각</option>
                  <option value="early_leave">조퇴</option>
                  <option value="makeup">보강</option>
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={saveBulkAttendance}
            className="mt-3 rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            수업 전체 출석 저장
          </button>
        </section>
      ) : null}

      <section className="flex items-center gap-2">
        <label className="text-sm">조회 월</label>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 dark:border-zinc-700"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </section>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>날짜</Th>
              <Th>수업</Th>
              <Th>학생</Th>
              <Th>상태</Th>
              <Th>사유</Th>
              <Th>보강상태</Th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <Td>{record.class_date}</Td>
                <Td>{record.classes?.name ?? "-"}</Td>
                <Td className="min-w-[5rem] whitespace-nowrap">{record.students?.name ?? "-"}</Td>
                <Td>{record.status}</Td>
                <Td>{record.reason ?? "-"}</Td>
                <Td>{record.makeup_status ?? "-"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={className ? `px-3 py-2 ${className}` : "px-3 py-2"}>{children}</td>;
}
