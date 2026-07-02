"use client";

import {
  CLASS_FEE_TIERS,
  type ClassFeeTierId,
  FEE_TIER_IDS,
  matchTierForClass,
  tierSummaryLabel,
} from "@/lib/class-fee-tiers";
import type { AcademyClass, Student } from "@/lib/types";
import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useState, type ReactNode } from "react";

type ClassWithEnrollments = AcademyClass & {
  enrollments: {
    id: string;
    student_id: string;
    students?: { id: string; name: string; grade: string } | null;
  }[];
};

type ClassForm = {
  name: string;
  teacher_name: string;
  class_type: "regular" | "trial" | "oneday";
  days_of_week: string[];
  start_time: string;
  end_time: string;
  fee_tier: ClassFeeTierId;
  capacity: number;
};

const dayOptions = [
  { value: "mon", label: "월" },
  { value: "tue", label: "화" },
  { value: "wed", label: "수" },
  { value: "thu", label: "목" },
  { value: "fri", label: "금" },
  { value: "sat", label: "토" },
  { value: "sun", label: "일" },
];

const initialEditForm = (): ClassForm => ({
  name: "",
  teacher_name: "",
  class_type: "regular",
  days_of_week: ["mon", "wed", "fri"],
  start_time: "14:00",
  end_time: "15:00",
  fee_tier: "weekly_2",
  capacity: 10,
});

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassWithEnrollments[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [editingClassId, setEditingClassId] = useState("");
  const [editForm, setEditForm] = useState<ClassForm>(initialEditForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setError("");
    const [classesRes, studentsRes] = await Promise.all([
      authFetch("/api/classes"),
      authFetch("/api/students?sort=name.asc"),
    ]);
    const classesJson = await classesRes.json();
    const studentsJson = await studentsRes.json();
    if (!classesRes.ok || !studentsRes.ok) {
      setError(classesJson.error ?? studentsJson.error ?? "Failed to load data.");
      return;
    }
    setClasses(classesJson.data);
    setStudents(studentsJson.data);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const enrollStudent = async () => {
    if (!selectedClass || !selectedStudent) return;
    const selectedClassItem = classes.find((klass) => klass.id === selectedClass);
    if (selectedClassItem?.class_status === "ended") {
      setError("종료된 수업에는 수강 등록할 수 없습니다. 먼저 운영중으로 변경하세요.");
      return;
    }
    setError("");
    setMessage("");
    const res = await authFetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: selectedClass, student_id: selectedStudent }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to enroll student.");
      return;
    }
    const student = students.find((item) => item.id === selectedStudent);
    setClasses((prev) =>
      prev.map((klass) =>
        klass.id === selectedClass
          ? {
              ...klass,
              enrollments: [
                ...klass.enrollments,
                { ...json.data, students: student ? { id: student.id, name: student.name, grade: student.grade } : null },
              ],
            }
          : klass
      )
    );
    setSelectedStudent("");
    setMessage("수강 등록이 완료되었습니다.");
  };

  const removeEnrollment = async (enrollmentId: string) => {
    setError("");
    setMessage("");
    const res = await authFetch(`/api/enrollments?id=${enrollmentId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "수강 해제에 실패했습니다.");
      return;
    }
    setClasses((prev) =>
      prev.map((klass) => ({
        ...klass,
        enrollments: klass.enrollments.filter((enroll) => enroll.id !== enrollmentId),
      }))
    );
    setMessage("수강생이 해제되었습니다.");
  };

  const startEdit = (klass: ClassWithEnrollments) => {
    setEditingClassId(klass.id);
    const matched =
      matchTierForClass({
        monthly_fee: Number(klass.monthly_fee ?? 0),
        monthly_sessions: Number(klass.monthly_sessions ?? 0),
        class_category: klass.class_category ?? "general",
      }) ?? "weekly_2";
    setEditForm({
      name: klass.name,
      teacher_name: klass.teacher_name,
      class_type: klass.class_type,
      days_of_week: klass.days_of_week ?? [],
      start_time: klass.start_time?.slice(0, 5) ?? "14:00",
      end_time: klass.end_time?.slice(0, 5) ?? "15:00",
      fee_tier: matched,
      capacity: Number(klass.capacity ?? 0),
    });
  };

  const saveEdit = async () => {
    if (!editingClassId) return;
    setError("");
    setMessage("");
    const res = await authFetch(`/api/classes/${editingClassId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        fee_tier: editForm.fee_tier,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "수업 수정에 실패했습니다.");
      return;
    }
    setClasses((prev) =>
      prev.map((klass) =>
        klass.id === editingClassId ? { ...klass, ...json.data, enrollments: klass.enrollments } : klass
      )
    );
    setEditingClassId("");
    setMessage("수업 정보가 수정되었습니다.");
  };

  const deleteClass = async (classId: string) => {
    const ok = window.confirm("수업을 삭제하시겠습니까? 수강 정보도 함께 삭제됩니다.");
    if (!ok) return;
    setError("");
    setMessage("");
    const res = await authFetch(`/api/classes/${classId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "수업 삭제에 실패했습니다.");
      return;
    }
    setClasses((prev) => prev.filter((klass) => klass.id !== classId));
    if (selectedClass === classId) setSelectedClass("");
    setMessage("수업이 삭제되었습니다.");
  };

  const toggleClassStatus = async (klass: ClassWithEnrollments) => {
    const nextStatus = klass.class_status === "active" ? "ended" : "active";
    const confirmText =
      nextStatus === "ended"
        ? "이 수업을 종료하시겠습니까? (수업 데이터는 유지됩니다.)"
        : "이 수업을 다시 운영중으로 전환하시겠습니까?";
    const ok = window.confirm(confirmText);
    if (!ok) return;

    setError("");
    setMessage("");
    const res = await authFetch(`/api/classes/${klass.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_status: nextStatus }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "수업 상태 변경에 실패했습니다.");
      return;
    }
    setClasses((prev) => prev.map((item) => (item.id === klass.id ? { ...item, ...json.data } : item)));
    setMessage(
      nextStatus === "ended"
        ? "수업이 종료 상태로 변경되었습니다. (데이터는 유지됩니다.)"
        : "수업이 운영중으로 변경되었습니다."
    );
  };

  const toggleDay = (day: string, checked: boolean) => {
    setEditForm((prev) => ({
      ...prev,
      days_of_week: checked
        ? [...prev.days_of_week, day]
        : prev.days_of_week.filter((value) => value !== day),
    }));
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">수업 관리</h1>
      <p className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
        등록된 수업은 매월 자동으로 이어지는 정기 수업입니다. <strong>새 반(수업) 추가</strong>는{" "}
        <strong>회원 관리</strong> 화면에서 이름·강사·요금 구간만으로 만들 수 있습니다. 여기서는 수강 등록·수정·종료를
        다룹니다.
      </p>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-3">
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
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
        <button
          type="button"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
          onClick={enrollStudent}
        >
          수강 등록
        </button>
      </section>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>수업명</Th>
              <Th>강사</Th>
              <Th>유형</Th>
              <Th>상태</Th>
              <Th>요일</Th>
              <Th>시간</Th>
              <Th>정원</Th>
              <Th>현재인원</Th>
              <Th>요금 구간</Th>
              <Th>수강생 관리</Th>
              <Th>작업</Th>
            </tr>
          </thead>
          <tbody>
            {classes.map((klass) => (
              <tr key={klass.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <Td>
                  {editingClassId === klass.id ? (
                    <input
                      className="w-32 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  ) : (
                    klass.name
                  )}
                </Td>
                <Td>
                  {editingClassId === klass.id ? (
                    <input
                      className="w-28 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                      value={editForm.teacher_name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, teacher_name: e.target.value }))}
                    />
                  ) : (
                    klass.teacher_name
                  )}
                </Td>
                <Td>
                  {editingClassId === klass.id ? (
                    <select
                      className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                      value={editForm.class_type}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          class_type: e.target.value as ClassForm["class_type"],
                        }))
                      }
                    >
                      <option value="regular">정규</option>
                      <option value="trial">체험</option>
                      <option value="oneday">원데이</option>
                    </select>
                  ) : (
                    klass.class_type
                  )}
                </Td>
                <Td>
                  {klass.class_status === "ended" ? (
                    <span className="rounded bg-zinc-200 px-2 py-1 text-xs dark:bg-zinc-800">종료</span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      운영중
                    </span>
                  )}
                </Td>
                <Td>
                  {editingClassId === klass.id ? (
                    <div className="flex min-w-32 flex-wrap gap-1">
                      {dayOptions.map((day) => (
                        <label key={day.value} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.days_of_week.includes(day.value)}
                            onChange={(e) => toggleDay(day.value, e.target.checked)}
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    klass.days_of_week.join(", ")
                  )}
                </Td>
                <Td>
                  {editingClassId === klass.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="w-20 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                        type="time"
                        value={editForm.start_time}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, start_time: e.target.value }))}
                      />
                      ~
                      <input
                        className="w-20 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                        type="time"
                        value={editForm.end_time}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, end_time: e.target.value }))}
                      />
                    </div>
                  ) : (
                    `${klass.start_time} - ${klass.end_time}`
                  )}
                </Td>
                <Td>
                  {editingClassId === klass.id ? (
                    <input
                      className="w-20 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                      type="number"
                      min={0}
                      value={editForm.capacity}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
                    />
                  ) : (
                    klass.capacity
                  )}
                </Td>
                <Td>
                  {klass.enrollments?.length ?? 0}/{klass.capacity}
                </Td>
                <Td className="max-w-[220px]">
                  {editingClassId === klass.id ? (
                    <select
                      className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
                      value={editForm.fee_tier}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, fee_tier: e.target.value as ClassFeeTierId }))
                      }
                    >
                      {FEE_TIER_IDS.map((id) => (
                        <option key={id} value={id}>
                          {CLASS_FEE_TIERS[id].label} · {CLASS_FEE_TIERS[id].monthly_fee.toLocaleString("ko-KR")}원 · 월{" "}
                          {CLASS_FEE_TIERS[id].monthly_sessions}회
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs leading-snug">{tierSummaryLabel(klass)}</span>
                  )}
                </Td>
                <Td>
                  <div className="flex min-w-48 flex-wrap gap-1">
                    {klass.enrollments.length === 0 ? (
                      <span className="text-xs opacity-60">없음</span>
                    ) : (
                      klass.enrollments.map((enroll) => (
                        <button
                          key={enroll.id}
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                          onClick={() => removeEnrollment(enroll.id)}
                          title="클릭 시 수강 해제"
                        >
                          {enroll.students?.name ?? enroll.student_id.slice(0, 6)} x
                        </button>
                      ))
                    )}
                  </div>
                </Td>
                <Td>
                  <div className="flex gap-2">
                    {editingClassId === klass.id ? (
                      <>
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                          onClick={saveEdit}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                          onClick={() => setEditingClassId("")}
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                          onClick={() => startEdit(klass)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                          onClick={() => toggleClassStatus(klass)}
                        >
                          {klass.class_status === "ended" ? "재개" : "종료"}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-800"
                          onClick={() => deleteClass(klass.id)}
                        >
                          삭제
                        </button>
                      </>
                    )}
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

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={className ? `px-3 py-2 ${className}` : "px-3 py-2"}>{children}</td>;
}
