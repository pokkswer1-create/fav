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

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "출석" },
  { value: "absent", label: "결석" },
  { value: "late", label: "지각" },
  { value: "early_leave", label: "조퇴" },
  { value: "makeup", label: "보강" },
];

function resolveClassStudents(
  selectedClass: ClassOption | undefined,
  allStudents: StudentOption[]
): StudentOption[] {
  if (!selectedClass?.enrollments?.length) return [];

  return selectedClass.enrollments
    .map((enroll) => {
      if (enroll.students?.name) {
        return { id: enroll.students.id, name: enroll.students.name };
      }
      const found = allStudents.find((student) => student.id === enroll.student_id);
      if (found) return found;
      if (enroll.student_id) {
        return { id: enroll.student_id, name: enroll.student_id.slice(0, 8) };
      }
      return null;
    })
    .filter((v): v is StudentOption => Boolean(v));
}

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
  const [checkExpanded, setCheckExpanded] = useState(false);

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

  useEffect(() => {
    if (!checkExpanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCheckExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [checkExpanded]);

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
  const classStudents = useMemo(
    () => resolveClassStudents(selectedClass, students),
    [selectedClass, students]
  );

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
    setCheckExpanded(false);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">출석 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}

      <form className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-3" onSubmit={saveAttendance}>
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setCheckExpanded(false);
          }}
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
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">출석체크</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {selectedClass?.name} · {classDate} · {classStudents.length}명
              </p>
            </div>
            {classStudents.length > 0 ? (
              <button
                type="button"
                onClick={() => setCheckExpanded(true)}
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                확대
              </button>
            ) : null}
          </div>

          {classStudents.length === 0 ? (
            <p className="text-sm text-zinc-500">이 수업에 등록된 학생이 없습니다.</p>
          ) : (
            <AttendanceCheckGrid
              students={classStudents}
              bulkStatuses={bulkStatuses}
              onStatusChange={(studentId, nextStatus) =>
                setBulkStatuses((prev) => ({ ...prev, [studentId]: nextStatus }))
              }
            />
          )}

          <button
            type="button"
            onClick={() => void saveBulkAttendance()}
            disabled={classStudents.length === 0}
            className="mt-3 rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            수업 전체 출석 저장
          </button>
        </section>
      ) : null}

      {checkExpanded && classStudents.length > 0 ? (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-zinc-950">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">출석체크 (확대)</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {selectedClass?.name} · {classDate}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCheckExpanded(false)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              닫기
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <AttendanceCheckGrid
              students={classStudents}
              bulkStatuses={bulkStatuses}
              expanded
              onStatusChange={(studentId, nextStatus) =>
                setBulkStatuses((prev) => ({ ...prev, [studentId]: nextStatus }))
              }
            />
          </div>

          <footer className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => void saveBulkAttendance()}
              className="w-full rounded bg-zinc-900 px-3 py-3 text-white dark:bg-zinc-100 dark:text-zinc-900 sm:w-auto"
            >
              수업 전체 출석 저장
            </button>
          </footer>
        </div>
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
                <Td className="min-w-[4rem] whitespace-nowrap">{record.classes?.name ?? "-"}</Td>
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

function AttendanceCheckGrid({
  students,
  bulkStatuses,
  onStatusChange,
  expanded = false,
}: {
  students: StudentOption[];
  bulkStatuses: Record<string, AttendanceStatus>;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  expanded?: boolean;
}) {
  return (
    <div
      className={
        expanded
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {students.map((student) => (
        <label
          key={student.id}
          className={`block rounded-xl border border-zinc-200 dark:border-zinc-700 ${
            expanded ? "p-4" : "p-3"
          }`}
        >
          <span
            className={`mb-2 block font-semibold leading-snug break-words text-zinc-900 dark:text-zinc-100 ${
              expanded ? "text-lg" : "text-sm"
            }`}
          >
            {student.name}
          </span>
          <select
            className="w-full rounded border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-700"
            value={bulkStatuses[student.id] ?? "present"}
            onChange={(e) => onStatusChange(student.id, e.target.value as AttendanceStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={className ? `px-3 py-2 ${className}` : "px-3 py-2"}>{children}</td>;
}
