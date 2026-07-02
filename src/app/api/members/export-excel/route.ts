import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServerWithAuth } from "@/lib/supabase/server-auth";
import { calculateFinalFee } from "@/lib/tuition";
import type { DiscountType, StudentStatus } from "@/lib/types";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

function isPlaceholderContact(value: string | null | undefined) {
  const t = (value ?? "").trim();
  if (!t) return true;
  if (t === "." || t === "．" || t === "-" || t === "—" || t === "–") return true;
  return false;
}

function primaryContact(row: {
  phone: string;
  father_phone: string | null;
  mother_phone: string | null;
  parent_phone: string | null;
}) {
  if (!isPlaceholderContact(row.phone)) return row.phone.trim();
  if (!isPlaceholderContact(row.father_phone)) return row.father_phone!.trim();
  if (!isPlaceholderContact(row.mother_phone)) return row.mother_phone!.trim();
  if (!isPlaceholderContact(row.parent_phone)) return row.parent_phone!.trim();
  return "";
}

function statusKo(status: StudentStatus) {
  if (status === "active") return "재원중";
  if (status === "paused") return "휴원";
  if (status === "withdrawn") return "퇴원";
  return status;
}

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServerWithAuth(request.headers.get("authorization"));
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let builder = supabaseServer
    .from("students")
    .select(
      "id, name, grade, phone, parent_name, parent_phone, father_phone, mother_phone, join_date, status, enrollments(monthly_fee, discount_type, discount_value, final_fee, classes(name))"
    )
    .order("join_date", { ascending: false });
  if (status) builder = builder.eq("status", status === "break" ? "paused" : status);

  const { data, error } = await builder;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const rows =
    data?.map((row) => {
      const enr = row.enrollments?.[0] as
        | {
            monthly_fee?: number;
            discount_type?: DiscountType;
            discount_value?: number;
            final_fee?: number;
            classes?: unknown;
          }
        | undefined;
      const classesValue = enr?.classes;
      let className = "";
      if (Array.isArray(classesValue)) {
        className = (classesValue[0] as { name?: string } | undefined)?.name ?? "";
      } else {
        className = (classesValue as { name?: string } | undefined)?.name ?? "";
      }
      const baseFee = Number(enr?.monthly_fee ?? 0);
      const discountType = (enr?.discount_type ?? "none") as DiscountType;
      const discountValue = Number(enr?.discount_value ?? 0);
      const finalFee = Number(
        enr?.final_fee && enr.final_fee > 0
          ? enr.final_fee
          : calculateFinalFee(baseFee, discountType, discountValue)
      );

      return {
        이름: row.name,
        "소속 반": className,
        학년: (() => {
          const g = (row.grade ?? "").trim();
          if (!g || g === "." || g === "．") return "";
          return g;
        })(),
        연락처: primaryContact({
          phone: row.phone,
          father_phone: row.father_phone,
          mother_phone: row.mother_phone,
          parent_phone: row.parent_phone,
        }),
        "기본 수강료": baseFee,
        "할인 유형": discountType,
        "할인 값": discountType === "none" ? 0 : discountValue,
        "최종 수강료": finalFee,
        상태: statusKo(row.status as StudentStatus),
        "학부모 이름": row.parent_name ?? "",
        "학부모 연락처": (row.parent_phone ?? "").trim(),
        "부 연락처": (row.father_phone ?? "").trim(),
        "모 연락처": (row.mother_phone ?? "").trim(),
        가입일: row.join_date,
      };
    }) ?? [];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "members_template");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const dateStr = new Date().toISOString().slice(0, 10);
  const utf8Name = encodeURIComponent(`회원-목록-${dateStr}.xlsx`);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="members-${dateStr}.xlsx"; filename*=UTF-8''${utf8Name}`,
    },
  });
}
