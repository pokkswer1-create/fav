"use client";

import { authFetch } from "@/lib/auth-fetch";
import { CLASS_FEE_TIERS, type ClassFeeTierId, FEE_TIER_IDS } from "@/lib/class-fee-tiers";
import type { DiscountType, Student } from "@/lib/types";
import { calculateFinalFee, formatWon } from "@/lib/tuition";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

type StudentWithMeta = Student & {
  enrollments?: {
    id: string;
    class_id: string;
    monthly_fee: number;
    discount_type: DiscountType;
    discount_value: number;
    discount_reason: string | null;
    final_fee: number;
    classes?: { id: string; name: string; monthly_fee: number } | null;
  }[];
  payments?: { month_key: string; status: "paid" | "pending" | "unpaid" | "refunded" }[];
};

type Summary = {
  totalMembers: number;
  waitingMembers: number;
  thisMonthPaid: number;
  thisMonthUnpaid: number;
  classStats: { classId: string; className: string; count: number }[];
};

type BulkAction = "change_class" | "change_status" | "apply_discount" | "set_payment_status" | "change_fee";

/** 결제 링크 발송 시 사용할 번호 */
type PaymentLinkPhoneField = "phone" | "father_phone" | "mother_phone";

const emptySummary: Summary = {
  totalMembers: 0,
  waitingMembers: 0,
  thisMonthPaid: 0,
  thisMonthUnpaid: 0,
  classStats: [],
};

const initialCreateForm = {
  name: "",
  phone: "",
  grade: "",
  join_date: new Date().toISOString().slice(0, 10),
  status: "active" as Student["status"],
};

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentWithMeta[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; monthly_fee: number }[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [activeMonth, setActiveMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeYear, setActiveYear] = useState(new Date().toISOString().slice(0, 4));
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [bulkAction, setBulkAction] = useState<BulkAction>("change_status");
  const [bulkStatus, setBulkStatus] = useState<Student["status"]>("active");
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkDiscountType, setBulkDiscountType] = useState<DiscountType>("amount");
  const [bulkDiscountValue, setBulkDiscountValue] = useState(0);
  const [bulkBaseFee, setBulkBaseFee] = useState(0);
  const [bulkMonth, setBulkMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bulkPaymentStatus, setBulkPaymentStatus] =
    useState<"paid" | "pending" | "unpaid" | "refunded">("paid");
  const [excelUploading, setExcelUploading] = useState(false);
  const [announcements, setAnnouncements] = useState<{ id: string; title: string }[]>([]);
  const [announcementId, setAnnouncementId] = useState("");
  const [smsText, setSmsText] = useState("");
  const [paymentLinkPhoneField, setPaymentLinkPhoneField] =
    useState<PaymentLinkPhoneField>("father_phone");

  const [quickClassName, setQuickClassName] = useState("");
  const [quickTeacher, setQuickTeacher] = useState("");
  const [quickFeeTier, setQuickFeeTier] = useState<ClassFeeTierId>("weekly_2");
  const [quickClassSaving, setQuickClassSaving] = useState(false);

  const [editingStudent, setEditingStudent] = useState<StudentWithMeta | null>(null);
  const [editStatus, setEditStatus] = useState<Student["status"]>("active");
  const [editClassId, setEditClassId] = useState("");
  const [editBaseFee, setEditBaseFee] = useState(0);
  const [editDiscountType, setEditDiscountType] = useState<DiscountType>("none");
  const [editDiscountValue, setEditDiscountValue] = useState(0);
  const [editDiscountReason, setEditDiscountReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [paymentLogs, setPaymentLogs] = useState<
    { id: string; student_id: string | null; month_key: string; to_status: string; reason: string | null; created_at: string }[]
  >([]);
  const [memberLogs, setMemberLogs] = useState<
    { id: string; student_id: string; action: string; reason: string | null; created_at: string }[]
  >([]);

  const monthKeys = useMemo(
    () => Array.from({ length: 12 }).map((_, idx) => `${activeYear}-${String(idx + 1).padStart(2, "0")}`),
    [activeYear]
  );

  const loadAnnouncements = async () => {
    const res = await authFetch("/api/announcements");
    const json = await res.json();
    if (res.ok) {
      setAnnouncements(
        (json.data ?? []).map((x: { id: string; title: string }) => ({ id: x.id, title: x.title }))
      );
    }
  };

  const loadClasses = async () => {
    const res = await authFetch("/api/classes");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "반 정보를 불러오지 못했습니다.");
      return;
    }
    setClasses(
      (json.data ?? []).map((klass: { id: string; name: string; monthly_fee: number }) => ({
        id: klass.id,
        name: klass.name,
        monthly_fee: Number(klass.monthly_fee ?? 0),
      }))
    );
  };

  const loadStudents = async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if (classId) params.set("classId", classId);
    if (paymentFilter) params.set("month", activeMonth);
    params.set("sort", "join_date.desc");
    params.set("includeSummary", "1");
    params.set("pageSize", "200");

    const res = await authFetch(`/api/students?${params.toString()}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "회원 목록을 불러오지 못했습니다.");
      return;
    }

    const rows = (json.data ?? []) as StudentWithMeta[];
    const filtered =
      paymentFilter === ""
        ? rows
        : rows.filter((student) => {
            const monthPayment = student.payments?.find((p) => p.month_key === activeMonth);
            if (paymentFilter === "paid") return monthPayment?.status === "paid";
            if (paymentFilter === "unpaid") return !monthPayment || monthPayment.status !== "paid";
            return true;
          });
    setStudents(filtered);
    setSummary((json.summary ?? emptySummary) as Summary);
  };

  const loadLogs = async () => {
    const [paymentRes, memberRes] = await Promise.all([
      authFetch("/api/payments/change-logs?limit=10"),
      authFetch("/api/students/change-logs?limit=10"),
    ]);
    const paymentJson = await paymentRes.json();
    const memberJson = await memberRes.json();
    if (paymentRes.ok) setPaymentLogs(paymentJson.data ?? []);
    if (memberRes.ok) setMemberLogs(memberJson.data ?? []);
  };

  const downloadFileWithAuth = async (url: string, fallbackFilename: string) => {
    const res = await authFetch(url);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "파일 다운로드에 실패했습니다.");
      return;
    }
    const blob = await res.blob();
    const contentDisposition = res.headers.get("content-disposition") ?? "";
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    const asciiMatch = contentDisposition.match(/filename=\"([^\"]+)\"/i);
    const filename = decodeURIComponent(utf8Match?.[1] ?? asciiMatch?.[1] ?? fallbackFilename);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const downloadExcel = async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (classId) params.set("classId", classId);
    await downloadFileWithAuth(
      `/api/members/export-excel?${params.toString()}`,
      `members-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const downloadTemplateExcel = async () => {
    await downloadFileWithAuth("/api/members/template-excel", "회원-일괄등록-템플릿.xlsx");
  };

  const uploadExcel = async (file: File) => {
    setExcelUploading(true);
    setError("");
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await authFetch("/api/members/import-excel", { method: "POST", body: formData });
    const json = (await res.json().catch(() => ({}))) as {
      imported?: number;
      errors?: { row: number; reason: string }[];
      error?: string;
      message?: string;
    };
    setExcelUploading(false);
    if (!res.ok) {
      setError(json.message ?? json.error ?? "엑셀 업로드 실패");
      return;
    }
    setMessage(`엑셀 업로드 완료: ${json.imported ?? 0}명 등록`);
    if ((json.errors ?? []).length > 0) {
      setError(
        `일부 실패: ${json.errors!
          .slice(0, 5)
          .map((item) => `#${item.row} ${item.reason}`)
          .join(", ")}`
      );
    }
    await loadStudents();
  };

  const sendPaymentLinksToSelected = async () => {
    if (checkedIds.length === 0) {
      setError("결제링크 발송할 회원을 먼저 선택해 주세요.");
      return;
    }
    setError("");
    const res = await authFetch("/api/payments/send-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberIds: checkedIds,
        month: activeMonth,
        channel: "kakao",
        phoneField: paymentLinkPhoneField,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { sent?: number; failed?: number; error?: string };
    if (!res.ok) {
      setError(json.error ?? "결제링크 일괄 발송 실패");
      return;
    }
    setMessage(`결제링크 발송 완료: 성공 ${json.sent ?? 0}, 실패 ${json.failed ?? 0}`);
  };

  const sendAnnouncement = async () => {
    if (!announcementId) {
      setError("발송할 안내를 선택해 주세요.");
      return;
    }
    const targetIds = checkedIds.length > 0 ? checkedIds : students.map((s) => s.id);
    if (targetIds.length === 0) {
      setError("안내를 보낼 회원이 없습니다.");
      return;
    }
    setError("");
    const res = await authFetch("/api/announcements/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId, memberIds: targetIds, channel: "kakao" }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      sentCount?: number;
      failCount?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(json.error ?? "안내 발송 실패");
      return;
    }
    setMessage(
      `안내 발송 완료 (카카오톡): 대상 ${targetIds.length}명, 성공 ${json.sentCount ?? 0}, 실패 ${json.failCount ?? 0}`
    );
  };

  const sendAnnouncementToOne = async (memberId: string) => {
    if (!announcementId) {
      setError("발송할 안내를 선택해 주세요.");
      return;
    }
    setError("");
    const res = await authFetch("/api/announcements/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId, memberIds: [memberId], channel: "kakao" }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      sentCount?: number;
      failCount?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(json.error ?? "안내 발송 실패");
      return;
    }
    setMessage(`안내 발송 완료 (카카오톡): 대상 1명, 성공 ${json.sentCount ?? 0}, 실패 ${json.failCount ?? 0}`);
  };

  const sendSmsBulk = async () => {
    if (!smsText.trim()) {
      setError("보낼 문자 내용을 입력해 주세요.");
      return;
    }
    const targetIds = checkedIds.length > 0 ? checkedIds : students.map((s) => s.id);
    if (targetIds.length === 0) {
      setError("문자를 보낼 회원이 없습니다.");
      return;
    }
    setError("");
    const res = await authFetch("/api/sms/enqueue-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: targetIds, message: smsText }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      requested?: number;
      enqueued?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(json.error ?? "문자 큐 등록 실패");
      return;
    }
    setMessage(
      `안드로이드 폰 문자 큐 등록 완료: 요청 ${json.requested ?? targetIds.length}명 중 ${json.enqueued ?? 0}명 대기열 추가`
    );
  };

  const deleteStudent = async (studentId: string, studentName: string) => {
    const ok = window.confirm(
      `${studentName} 회원을 삭제할까요?\n관련 출석/결제/수강 데이터도 함께 삭제됩니다.`
    );
    if (!ok) return;
    setError("");
    setMessage("");
    const res = await authFetch(`/api/students/${studentId}`, { method: "DELETE" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "회원 삭제에 실패했습니다.");
      return;
    }
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setCheckedIds((prev) => prev.filter((id) => id !== studentId));
    setMessage(`${studentName} 회원을 삭제했습니다.`);
    await loadStudents();
  };

  const deleteSelectedStudents = async () => {
    if (checkedIds.length === 0) {
      setError("삭제할 회원을 먼저 선택해 주세요.");
      return;
    }
    const ok = window.confirm(
      `선택한 ${checkedIds.length}명을 삭제할까요?\n관련 출석/결제/수강 데이터도 함께 삭제됩니다.`
    );
    if (!ok) return;
    setError("");
    setMessage("");
    const res = await authFetch("/api/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: checkedIds }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      deleted?: number;
      failed?: number;
    };
    if (!res.ok) {
      setError(json.error ?? "선택 회원 삭제에 실패했습니다.");
      return;
    }
    const removed = new Set(checkedIds);
    setStudents((prev) => prev.filter((s) => !removed.has(s.id)));
    setCheckedIds([]);
    setMessage(
      `선택 회원 삭제 완료: ${json.deleted ?? 0}명 삭제${(json.failed ?? 0) > 0 ? `, ${json.failed}명 실패` : ""}`
    );
    await loadStudents();
  };

  useEffect(() => {
    void loadClasses();
    void loadAnnouncements();
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth]);

  const createStudent = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await authFetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "회원 생성 실패");
      return;
    }
    setCreateForm(initialCreateForm);
    setMessage("회원이 등록되었습니다.");
    await loadStudents();
  };

  const createQuickClass = async (event: FormEvent) => {
    event.preventDefault();
    const name = quickClassName.trim();
    const teacher = quickTeacher.trim();
    if (!name || !teacher) {
      setError("반 이름과 강사명을 입력해 주세요.");
      return;
    }
    setError("");
    setQuickClassSaving(true);
    const res = await authFetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        teacher_name: teacher,
        class_type: "regular",
        fee_tier: quickFeeTier,
        days_of_week: ["mon", "wed", "fri"],
        start_time: "16:00",
        end_time: "17:00",
        capacity: 20,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setQuickClassSaving(false);
    if (!res.ok) {
      setError(json.error ?? "반 만들기 실패");
      return;
    }
    setQuickClassName("");
    setQuickTeacher("");
    setMessage(`반「${name}」을(를) 만들었습니다.`);
    await loadClasses();
  };

  const applyBulkAction = async () => {
    if (checkedIds.length === 0) {
      setError("일괄 작업할 회원을 선택해 주세요.");
      return;
    }
    const payload: Record<string, unknown> = { action: bulkAction, studentIds: checkedIds };
    if (bulkAction === "change_status") payload.status = bulkStatus;
    if (bulkAction === "change_class") payload.class_id = bulkClassId;
    if (bulkAction === "apply_discount") {
      payload.discount_type = bulkDiscountType;
      payload.discount_value = bulkDiscountValue;
    }
    if (bulkAction === "set_payment_status") {
      payload.month_key = bulkMonth;
      payload.payment_status = bulkPaymentStatus;
    }
    if (bulkAction === "change_fee") {
      payload.monthly_fee = bulkBaseFee;
      payload.discount_type = bulkDiscountType;
      payload.discount_value = bulkDiscountValue;
    }

    const res = await authFetch("/api/students/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "일괄 처리 실패");
      return;
    }
    setMessage(`일괄 처리 완료: ${json.affected}/${json.requested}`);
    await loadStudents();
    await loadLogs();
  };

  const toggleMonthPayment = async (student: StudentWithMeta, monthKey: string) => {
    const prev = student.payments?.find((p) => p.month_key === monthKey)?.status;
    const nextStatus = prev === "paid" ? "unpaid" : "paid";
    const enrollment = student.enrollments?.[0];
    const amountDue = Number(enrollment?.final_fee ?? enrollment?.monthly_fee ?? 0);
    const res = await authFetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payments: [
          {
            month_key: monthKey,
            amount_due: amountDue,
            status: nextStatus,
            payment_method: "manual",
            reason: "matrix_toggle",
          },
        ],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "결제 상태 변경 실패");
      return;
    }
    setStudents((prevRows) => prevRows.map((row) => (row.id === student.id ? json.data : row)));
    await loadLogs();
  };

  const openEditModal = (student: StudentWithMeta) => {
    const enrollment = student.enrollments?.[0];
    setEditingStudent(student);
    setEditStatus(student.status);
    setEditClassId(enrollment?.class_id ?? "");
    setEditBaseFee(Number(enrollment?.monthly_fee ?? enrollment?.classes?.monthly_fee ?? 0));
    setEditDiscountType(enrollment?.discount_type ?? "none");
    setEditDiscountValue(Number(enrollment?.discount_value ?? 0));
    setEditDiscountReason(enrollment?.discount_reason ?? "");
    setEditNotes(student.notes ?? "");
  };

  const saveEditModal = async () => {
    if (!editingStudent) return;
    const finalFee = calculateFinalFee(editBaseFee, editDiscountType, editDiscountValue);
    const res = await authFetch(`/api/students/${editingStudent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: editStatus,
        notes: editNotes,
        enrollment: {
          class_id: editClassId,
          monthly_fee: editBaseFee,
          discount_type: editDiscountType,
          discount_value: editDiscountValue,
          discount_reason: editDiscountReason || null,
          final_fee: finalFee,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "회원 수정 실패");
      return;
    }
    setEditingStudent(null);
    setStudents((prevRows) => prevRows.map((row) => (row.id === editingStudent.id ? json.data : row)));
    setMessage("회원 정보가 저장되었습니다.");
    await loadLogs();
  };

  const cardFilter = (type: "all" | "waiting" | "paid" | "unpaid" | string) => {
    if (type === "all") {
      setStatus("");
      setClassId("");
      setPaymentFilter("");
      void loadStudents();
      return;
    }
    if (type === "waiting") {
      setStatus("paused");
      setPaymentFilter("");
      void loadStudents();
      return;
    }
    if (type === "paid") {
      setPaymentFilter("paid");
      void loadStudents();
      return;
    }
    if (type === "unpaid") {
      setPaymentFilter("unpaid");
      void loadStudents();
      return;
    }
    setClassId(type);
    setPaymentFilter("");
    void loadStudents();
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const smsQrConfig =
    supabaseUrl && supabaseKey
      ? {
          type: "sms_gateway_config",
          supabaseUrl,
          supabaseKey,
          projectName: "학원 관리 시스템",
          deviceName: "원장님폰-1",
        }
      : null;
  const smsQrText = smsQrConfig ? JSON.stringify(smsQrConfig) : "";
  const selectedStudents = students.filter((s) => checkedIds.includes(s.id));

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-semibold">회원 관리 통합 운영</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard title="총 회원" value={`${summary.totalMembers}명`} onClick={() => cardFilter("all")} />
        <SummaryCard title="승인 대기(휴원)" value={`${summary.waitingMembers}명`} onClick={() => cardFilter("waiting")} />
        <SummaryCard title="이번달 결제 완료" value={`${summary.thisMonthPaid}명`} onClick={() => cardFilter("paid")} />
        <SummaryCard title="이번달 미결제" value={`${summary.thisMonthUnpaid}명`} onClick={() => cardFilter("unpaid")} />
      </section>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">반별 인원 현황</h2>
        <div className="flex flex-wrap gap-2">
          {summary.classStats.map((row) => (
            <button
              key={row.classId}
              type="button"
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              onClick={() => cardFilter(row.classId)}
            >
              {row.className} ({row.count}명)
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-5">
        <div className="md:col-span-2">
          <h2 className="text-sm font-semibold">회원 일괄 등록/다운로드</h2>
          <p className="mt-1 text-xs opacity-75">
            템플릿은 회원 목록과 같은 한글 열 이름(이름·소속 반·연락처·기본 수강료 등)을 사용합니다. 연락처가 비어 있으면 부·모 번호로 채워집니다.
          </p>
        </div>
        <label className="flex cursor-pointer items-center justify-center rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
          {excelUploading ? "업로드 중..." : "엑셀 파일 업로드"}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={excelUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadExcel(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void downloadTemplateExcel()}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
        >
          템플릿 다운로드
        </button>
        <button
          type="button"
          onClick={() => void downloadExcel()}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
        >
          현재 목록 엑셀 다운로드
        </button>
      </section>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">문자 큐 · 카카오톡 안내 발송</h2>
        <p className="mt-1 text-xs opacity-75">
          체크한 회원이 있으면 선택 회원만, 없으면 현재 목록 전체에게 발송합니다. 문자는 Supabase sms_queue에 쌓이며 안드로이드 폰 앱이 가져갑니다.
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="h-28 w-full max-w-xs rounded border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700">
            <p className="mb-1 font-semibold">선택된 회원</p>
            {selectedStudents.length === 0 ? (
              <p className="text-zinc-500">체크된 회원이 없으면 목록 전체가 대상입니다.</p>
            ) : (
              <ul className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                {selectedStudents.map((s) => (
                  <li
                    key={s.id}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800"
                  >
                    {s.name} ({s.father_phone || s.parent_phone || s.mother_phone || s.phone})
                  </li>
                ))}
              </ul>
            )}
          </div>
          <textarea
            className="h-28 w-full max-w-md rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            placeholder="학부모에게 보낼 문자 내용…"
            value={smsText}
            onChange={(e) => setSmsText(e.target.value)}
          />
          <div className="flex w-44 flex-col gap-2">
            <button
              type="button"
              onClick={() => void sendSmsBulk()}
              className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              문자 큐 등록
            </button>
            {smsQrConfig ? (
              <div className="flex flex-1 items-center justify-center rounded border border-dashed border-zinc-300 px-1 py-1 text-[10px] dark:border-zinc-700">
                <div className="flex flex-col items-center gap-1">
                  <div className="rounded bg-white p-1 dark:bg-zinc-900">
                    <QRCodeSVG value={smsQrText} size={56} includeMargin={false} />
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">앱에서 QR 스캔</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-rose-500">Supabase 환경변수 미설정으로 QR 생성 불가</p>
            )}
          </div>
          <div className="flex w-56 flex-col justify-between gap-2">
            <select
              className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700"
              value={announcementId}
              onChange={(e) => setAnnouncementId(e.target.value)}
            >
              <option value="">카카오톡으로 보낼 안내 선택</option>
              {announcements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void sendAnnouncement()}
              className="rounded bg-zinc-900 px-3 py-2 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {checkedIds.length > 0 ? "선택 회원 안내 발송" : "현재 목록 안내 발송"}
            </button>
          </div>
        </div>
      </section>

      <form className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-5" onSubmit={createStudent}>
        <input className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="이름" value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} required />
        <input className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="연락처" value={createForm.phone} onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))} required />
        <input className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="학년" value={createForm.grade} onChange={(e) => setCreateForm((prev) => ({ ...prev, grade: e.target.value }))} required />
        <input type="date" className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={createForm.join_date} onChange={(e) => setCreateForm((prev) => ({ ...prev, join_date: e.target.value }))} />
        <button type="submit" className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">회원 추가</button>
      </form>

      <form
        className="grid gap-3 rounded-xl border border-dashed border-zinc-400 p-4 dark:border-zinc-600 md:grid-cols-6"
        onSubmit={createQuickClass}
      >
        <div className="md:col-span-6 text-sm font-semibold">반 빠르게 만들기</div>
        <p className="md:col-span-6 -mt-1 text-xs opacity-75">
          월 수강료는 직접 입력하지 않습니다. 주1회·주2회·주3회·대표팀·트라이아웃 중 선택하면 금액·월 수업 횟수가 정해집니다. 기본 일정은 월·수·금 16:00~17:00(정원 20명)이며,{" "}
          <Link className="underline" href="/classes">
            수업 관리
          </Link>
          에서 바꿀 수 있습니다.
        </p>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="반 이름"
          value={quickClassName}
          onChange={(e) => setQuickClassName(e.target.value)}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="강사명"
          value={quickTeacher}
          onChange={(e) => setQuickTeacher(e.target.value)}
        />
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 md:col-span-2 dark:border-zinc-700"
          value={quickFeeTier}
          onChange={(e) => setQuickFeeTier(e.target.value as ClassFeeTierId)}
        >
          {FEE_TIER_IDS.map((id) => (
            <option key={id} value={id}>
              {CLASS_FEE_TIERS[id].label} · {CLASS_FEE_TIERS[id].monthly_fee.toLocaleString("ko-KR")}원 · 월{" "}
              {CLASS_FEE_TIERS[id].monthly_sessions}회
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={quickClassSaving}
          className="rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {quickClassSaving ? "만드는 중…" : "반 만들기"}
        </button>
      </form>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-6">
        <input className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="이름/연락처 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">전체 상태</option>
          <option value="active">재원중</option>
          <option value="paused">휴원</option>
          <option value="withdrawn">퇴원</option>
        </select>
        <select className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">전체 반</option>
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>{klass.name}</option>
          ))}
        </select>
        <select className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="">결제 전체</option>
          <option value="paid">이번달 결제 완료</option>
          <option value="unpaid">이번달 미결제</option>
        </select>
        <input type="month" className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={activeMonth} onChange={(e) => { setActiveMonth(e.target.value); setActiveYear(e.target.value.slice(0, 4)); }} />
        <button type="button" className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700" onClick={() => void loadStudents()}>
          {loading ? "조회 중..." : "검색"}
        </button>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-7">
        <select className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={bulkAction} onChange={(e) => setBulkAction(e.target.value as BulkAction)}>
          <option value="change_status">상태 일괄 변경</option>
          <option value="change_class">반 일괄 변경</option>
          <option value="apply_discount">할인 일괄 적용</option>
          <option value="change_fee">기본 수강료 일괄 변경</option>
          <option value="set_payment_status">월 결제상태 일괄 처리</option>
        </select>
        {bulkAction === "change_status" ? (
          <select
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as Student["status"])}
          >
            <option value="active">재원중</option>
            <option value="paused">휴원</option>
            <option value="withdrawn">퇴원</option>
          </select>
        ) : null}
        {bulkAction === "change_class" ? (
          <select
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            value={bulkClassId}
            onChange={(e) => setBulkClassId(e.target.value)}
          >
            <option value="">반 선택</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        ) : null}
        {bulkAction === "apply_discount" ? (
          <>
            <select
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={bulkDiscountType}
              onChange={(e) => setBulkDiscountType(e.target.value as DiscountType)}
            >
              <option value="none">할인 없음</option>
              <option value="amount">정액 할인</option>
              <option value="percent">정률 할인</option>
            </select>
            <input
              type="number"
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="할인값"
              value={bulkDiscountValue}
              onChange={(e) => setBulkDiscountValue(Number(e.target.value))}
            />
          </>
        ) : null}
        {bulkAction === "change_fee" ? (
          <>
            <input
              type="number"
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="새 기본 수강료"
              value={bulkBaseFee}
              onChange={(e) => setBulkBaseFee(Number(e.target.value))}
            />
            <select
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={bulkDiscountType}
              onChange={(e) => setBulkDiscountType(e.target.value as DiscountType)}
            >
              <option value="none">할인 없음</option>
              <option value="amount">정액 할인</option>
              <option value="percent">정률 할인</option>
            </select>
            <input
              type="number"
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="할인값(선택)"
              value={bulkDiscountValue}
              onChange={(e) => setBulkDiscountValue(Number(e.target.value))}
            />
          </>
        ) : null}
        {bulkAction === "set_payment_status" ? (
          <>
            <input
              type="month"
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={bulkMonth}
              onChange={(e) => setBulkMonth(e.target.value)}
            />
            <select
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={bulkPaymentStatus}
              onChange={(e) =>
                setBulkPaymentStatus(e.target.value as "paid" | "pending" | "unpaid" | "refunded")
              }
            >
              <option value="paid">결제완료</option>
              <option value="pending">진행중</option>
              <option value="unpaid">미결제</option>
              <option value="refunded">환불</option>
            </select>
          </>
        ) : null}
        <button type="button" className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900" onClick={() => void applyBulkAction()}>
          선택 {checkedIds.length}명 일괄처리
        </button>
        <button
          type="button"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          onClick={() => void sendPaymentLinksToSelected()}
        >
          선택 회원 결제링크 발송
        </button>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void deleteSelectedStudents()}
          className="rounded border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:hover:bg-rose-950/30"
        >
          선택 회원 삭제
        </button>
      </section>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-[1820px] text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>
                <input type="checkbox" checked={students.length > 0 && checkedIds.length === students.length} onChange={(e) => setCheckedIds(e.target.checked ? students.map((s) => s.id) : [])} />
              </Th>
              <Th>이름</Th>
              <Th>소속 반</Th>
              <Th className="min-w-[200px]">본인·부·모 연락처</Th>
              <Th>학년</Th>
              <Th>기본 수강료</Th>
              <Th>할인</Th>
              <Th>최종 수강료</Th>
              <Th>월별 결제</Th>
              <Th>상태</Th>
              <Th>관리</Th>
              <Th>안내</Th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const enrollment = student.enrollments?.[0];
              const baseFee = Number(enrollment?.monthly_fee ?? enrollment?.classes?.monthly_fee ?? 0);
              const discountType = enrollment?.discount_type ?? "none";
              const discountValue = Number(enrollment?.discount_value ?? 0);
              const finalFee = Number(
                enrollment?.final_fee ?? calculateFinalFee(baseFee, discountType, discountValue)
              );
              return (
                <tr key={student.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <Td>
                    <input
                      type="checkbox"
                      checked={checkedIds.includes(student.id)}
                      onChange={(e) =>
                        setCheckedIds((prev) =>
                          e.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id)
                        )
                      }
                    />
                  </Td>
                  <Td>
                    <button type="button" className="underline" onClick={() => openEditModal(student)}>
                      {student.name}
                    </button>
                    <div className="text-xs opacity-70">
                      <Link href={`/students/${student.id}`}>상세 보기</Link>
                    </div>
                  </Td>
                  <Td>{enrollment?.classes?.name ?? "-"}</Td>
                  <Td className="min-w-[200px]">
                    <ContactLines student={student} />
                  </Td>
                  <Td>{formatGradeDisplay(student.grade)}</Td>
                  <Td>{formatWon(baseFee)}</Td>
                  <Td>
                    {discountType === "none"
                      ? "없음"
                      : discountType === "amount"
                        ? `${discountValue.toLocaleString("ko-KR")}원`
                        : `${discountValue}%`}
                  </Td>
                  <Td className="font-semibold">{formatWon(finalFee)}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {monthKeys.map((key, idx) => {
                        const payment = student.payments?.find((p) => p.month_key === key);
                        const isPaid = payment?.status === "paid";
                        const isCurrent = key === activeMonth;
                        return (
                          <button
                            key={key}
                            type="button"
                            title={`${idx + 1}월: ${paymentStatusKo(payment?.status)}`}
                            onClick={() => void toggleMonthPayment(student, key)}
                            className={`h-5 w-5 rounded text-[10px] ${
                              isPaid
                                ? "bg-emerald-500 text-white"
                                : isCurrent
                                  ? "bg-blue-500 text-white"
                                  : "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </Td>
                  <Td>{statusLabel(student.status)}</Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                        onClick={() => openEditModal(student)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                        onClick={() => void deleteStudent(student.id, student.name)}
                      >
                        삭제
                      </button>
                    </div>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      onClick={() => void sendAnnouncementToOne(student.id)}
                    >
                      안내 발송
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingStudent ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">{editingStudent.name} 회원 정보 수정</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={editClassId} onChange={(e) => {
                const nextClassId = e.target.value;
                const found = classes.find((klass) => klass.id === nextClassId);
                setEditClassId(nextClassId);
                if (found) setEditBaseFee(found.monthly_fee);
              }}>
                <option value="">반 선택</option>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>{klass.name}</option>
                ))}
              </select>
              <select className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={editStatus} onChange={(e) => setEditStatus(e.target.value as Student["status"])}>
                <option value="active">재원중</option>
                <option value="paused">휴원</option>
                <option value="withdrawn">퇴원</option>
              </select>
              <input type="number" className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={editBaseFee} onChange={(e) => setEditBaseFee(Number(e.target.value))} placeholder="기본 수강료" />
              <select className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={editDiscountType} onChange={(e) => setEditDiscountType(e.target.value as DiscountType)}>
                <option value="none">할인 없음</option>
                <option value="amount">정액 할인</option>
                <option value="percent">정률 할인</option>
              </select>
              <input type="number" className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={editDiscountValue} onChange={(e) => setEditDiscountValue(Number(e.target.value))} placeholder="할인 값" />
              <input className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" value={editDiscountReason} onChange={(e) => setEditDiscountReason(e.target.value)} placeholder="할인 사유" />
              <textarea className="md:col-span-2 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="관리자 메모" />
            </div>
            <p className="mt-2 text-sm opacity-80">최종 수강료: {formatWon(calculateFinalFee(editBaseFee, editDiscountType, editDiscountValue))}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700" onClick={() => setEditingStudent(null)}>
                취소
              </button>
              <button type="button" className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900" onClick={() => void saveEditModal()}>
                저장
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="mb-2 font-semibold">최근 회원 변경 이력</h3>
          <ul className="space-y-1 text-sm">
            {memberLogs.map((log) => (
              <li key={log.id}>
                {new Date(log.created_at).toLocaleString("ko-KR")} · {log.action}
                {log.reason ? ` (${log.reason})` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="mb-2 font-semibold">최근 결제 변경 이력</h3>
          <ul className="space-y-1 text-sm">
            {paymentLogs.map((log) => (
              <li key={log.id}>
                {new Date(log.created_at).toLocaleString("ko-KR")} · {log.month_key} · {log.to_status}
                {log.reason ? ` (${log.reason})` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: Student["status"]) {
  if (status === "active") return "재원중";
  if (status === "paused") return "휴원";
  if (status === "withdrawn") return "퇴원";
  return status;
}

function isPlaceholderContact(value: string | null | undefined) {
  const t = (value ?? "").trim();
  if (!t) return true;
  if (t === "." || t === "．" || t === "-" || t === "—" || t === "–") return true;
  return false;
}

function contactText(value: string | null | undefined) {
  if (isPlaceholderContact(value)) return "—";
  return (value ?? "").trim();
}

function ContactLines({ student }: { student: Student }) {
  return (
    <div className="flex flex-col gap-0.5 text-[12px] leading-snug">
      <div>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">본인</span>{" "}
        <span className="tabular-nums">{contactText(student.phone)}</span>
      </div>
      <div>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">부</span>{" "}
        <span className="tabular-nums">{contactText(student.father_phone)}</span>
      </div>
      <div>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">모</span>{" "}
        <span className="tabular-nums">{contactText(student.mother_phone)}</span>
      </div>
    </div>
  );
}

function formatGradeDisplay(grade: string) {
  const t = (grade ?? "").trim();
  if (!t || t === "." || t === "．") return "—";
  return t;
}

function paymentStatusKo(status: string | undefined) {
  switch (status) {
    case "paid":
      return "결제완료";
    case "pending":
      return "대기";
    case "unpaid":
      return "미납";
    case "refunded":
      return "환불";
    default:
      return "미납";
  }
}

function SummaryCard({ title, value, onClick }: { title: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-zinc-200 p-4 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40">
      <p className="text-sm opacity-75">{title}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </button>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={className ? `px-3 py-2 text-left font-medium ${className}` : "px-3 py-2 text-left font-medium"}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={className ? `px-3 py-2 align-top ${className}` : "px-3 py-2 align-top"}>{children}</td>;
}
