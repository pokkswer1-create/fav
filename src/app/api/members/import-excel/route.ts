import { requireRole } from "@/lib/auth/guards";
import {
  isMissingEnrollmentDiscountColumn,
  supabaseErrorText,
} from "@/lib/enrollment-db-compat";
import { getSupabaseServer } from "@/lib/supabase/server";
import { calculateFinalFee } from "@/lib/tuition";
import type { DiscountType } from "@/lib/types";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

type InputRow = {
  [key: string]: unknown;
};

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = toText(v).replaceAll(",", "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function pick(row: InputRow, keys: string[]): string {
  for (const key of keys) {
    const value = toText(row[key]);
    if (value) return value;
  }
  return "";
}

/** 엑셀에서 자리 채우기용 ".", "-", "없음" 등은 비어 있는 것으로 취급 */
function normalizeCell(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (t === "." || t === "．" || t === "-" || t === "—" || t === "–" || lower === "n/a" || lower === "없음") {
    return "";
  }
  return t;
}

function normalizeIsoDate(input: string): { ok: true; value: string } | { ok: false; reason: string } {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ok: false, reason: "format" };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return { ok: false, reason: "nan" };
  if (mo < 1 || mo > 12) return { ok: false, reason: "month" };
  if (d < 1 || d > 31) return { ok: false, reason: "day" };
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // Ensure calendar-valid (e.g., 2026-04-31 should fail)
  const yy = dt.getUTCFullYear();
  const mm = dt.getUTCMonth() + 1;
  const dd = dt.getUTCDate();
  if (yy !== y || mm !== mo || dd !== d) return { ok: false, reason: "calendar" };
  return { ok: true, value: raw };
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: "파일이 필요합니다." }, { status: 400 });
  }

  const supabaseServer = getSupabaseServer();
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<InputRow>(sheet, { defval: "" });
  const { data: classes } = await supabaseServer.from("classes").select("id, name");
  const classMap = new Map(
    (classes ?? []).map((c) => [toText(c.name).toLowerCase(), c.id as string])
  );

  let imported = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];

    const studentName = normalizeCell(pick(row, ["studentName", "name", "학생명", "이름"]));
    const fatherPhoneRaw = normalizeCell(
      pick(row, ["fatherPhone", "father_phone", "부연락처", "아버지연락처", "부 연락처"])
    );
    const motherPhoneRaw = normalizeCell(
      pick(row, ["motherPhone", "mother_phone", "모연락처", "어머니연락처", "모 연락처"])
    );
    const parentPhoneRaw = normalizeCell(
      pick(row, ["parentPhone", "parent_phone", "학부모연락처", "학부모 연락처"])
    );
    const phoneDirect = normalizeCell(pick(row, ["phone", "studentPhone", "휴대폰", "연락처", "핸드폰"]));
    let phone = phoneDirect || fatherPhoneRaw || motherPhoneRaw || parentPhoneRaw;

    const gradeRaw = normalizeCell(pick(row, ["grade", "학년", "학년/학부"]));
    const grade = gradeRaw || "성인";

    const joinDate = normalizeCell(pick(row, ["startDate", "joinDate", "join_date", "가입일", "시작일"]));
    const statusRaw = normalizeCell(pick(row, ["status", "상태"])).toLowerCase();
    const monthlyFeeRaw =
      row.monthlyFee ??
      row.monthly_fee ??
      row["월수강료"] ??
      row["월료"] ??
      row["기본 수강료"] ??
      row["기본수강료"];
    const parentName = normalizeCell(pick(row, ["parentName", "parent_name", "학부모이름", "학부모 이름"]));
    const parentPhone = parentPhoneRaw;
    const fatherPhone = fatherPhoneRaw;
    const motherPhone = motherPhoneRaw;
    const classIdRaw = normalizeCell(pick(row, ["classId", "class_id"]));
    const className = normalizeCell(
      pick(row, ["className", "class", "반이름", "반 이름", "소속 반", "소속반"])
    );

    const discountTypeRaw = normalizeCell(
      pick(row, ["discount_type", "discountType", "할인유형", "할인 유형"])
    ).toLowerCase();
    const discountValueRaw =
      row.discount_value ?? row.discountValue ?? row["할인값"] ?? row["할인 값"] ?? row["할인금액"];
    const finalFeeRaw = row.final_fee ?? row.finalFee ?? row["최종 수강료"] ?? row["최종수강료"];

    // 템플릿에 남아있는 빈 줄/서식 줄은 오류로 보지 않고 건너뜀
    const isEffectivelyEmpty =
      !studentName &&
      !phoneDirect &&
      !fatherPhoneRaw &&
      !motherPhoneRaw &&
      !parentPhoneRaw &&
      !gradeRaw &&
      !joinDate &&
      !parentName &&
      !classIdRaw &&
      !className &&
      toNumber(monthlyFeeRaw) === 0;
    if (isEffectivelyEmpty) {
      continue;
    }

    if (!studentName || !phone) {
      errors.push({
        row: idx + 2,
        reason: "필수 컬럼 누락(이름/연락처 — 연락처·부·모·학부모 중 하나 필요)",
      });
      continue;
    }

    let discountType: DiscountType = "none";
    if (
      discountTypeRaw.includes("amount") ||
      discountTypeRaw.includes("금액") ||
      discountTypeRaw === "원"
    ) {
      discountType = "amount";
    } else if (
      discountTypeRaw.includes("percent") ||
      discountTypeRaw.includes("%") ||
      discountTypeRaw.includes("퍼센트") ||
      discountTypeRaw.includes("할인율")
    ) {
      discountType = "percent";
    }
    const discountValue = toNumber(discountValueRaw);
    const baseFee = toNumber(monthlyFeeRaw);
    const finalFeeFromSheet = toNumber(finalFeeRaw);
    const computedFinal =
      finalFeeFromSheet > 0 ? finalFeeFromSheet : calculateFinalFee(baseFee, discountType, discountValue);

    const mappedStatus =
      statusRaw === "break" || statusRaw === "paused" || statusRaw === "휴원"
        ? "paused"
        : statusRaw === "withdrawn" || statusRaw === "탈원"
          ? "withdrawn"
          : "active";

    let normalizedJoinDate = new Date().toISOString().slice(0, 10);
    if (joinDate) {
      const parsed = normalizeIsoDate(joinDate);
      if (!parsed.ok) {
        errors.push({ row: idx + 2, reason: `가입일(startDate/joinDate)이 올바르지 않습니다: ${joinDate}` });
        continue;
      }
      normalizedJoinDate = parsed.value;
    }

    const { data: student, error } = await supabaseServer
      .from("students")
      .insert({
        name: studentName,
        phone,
        grade,
        status: mappedStatus,
        join_date: normalizedJoinDate,
        parent_name: parentName || null,
        parent_phone: parentPhone || null,
        father_phone: fatherPhone || null,
        mother_phone: motherPhone || null,
      })
      .select("id")
      .single();

    if (error || !student) {
      errors.push({ row: idx + 2, reason: error?.message ?? "등록 실패" });
      continue;
    }

    const classId =
      classIdRaw || (className ? (classMap.get(className.toLowerCase()) ?? "") : "");
    if (classId) {
      const fullEnrollment = {
        student_id: student.id,
        class_id: classId,
        monthly_fee: baseFee,
        discount_type: discountType,
        discount_value: discountValue,
        final_fee: computedFinal,
      };
      let enr = await supabaseServer.from("enrollments").upsert(fullEnrollment, {
        onConflict: "student_id,class_id",
      });
      if (enr.error && isMissingEnrollmentDiscountColumn(supabaseErrorText(enr.error))) {
        enr = await supabaseServer.from("enrollments").upsert(
          {
            student_id: student.id,
            class_id: classId,
            monthly_fee: baseFee,
          },
          { onConflict: "student_id,class_id" }
        );
      }
      if (enr.error) {
        errors.push({ row: idx + 2, reason: supabaseErrorText(enr.error) || "수강 등록 실패" });
      }
    }

    imported += 1;
  }

  return NextResponse.json({ success: true, imported, errors });
}
