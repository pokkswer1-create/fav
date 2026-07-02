import { requireRole } from "@/lib/auth/guards";
import { monthRange, monthRangeTs } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const monthKey = new Date().toISOString().slice(0, 7);
  const range = monthRange(monthKey);
  const rangeTs = monthRangeTs(monthKey);

  const [studentsRes, paymentsRes, attendanceRes, salaryRes, journalsRes, naverRes, kakaoRes] = await Promise.all([
    supabaseServer.from("students").select("id", { count: "exact", head: true }),
    supabaseServer
      .from("payments")
      .select("amount_due, amount_paid, status")
      .eq("month_key", monthKey),
    supabaseServer
      .from("attendance_records")
      .select("status")
      .gte("class_date", range.from)
      .lte("class_date", range.to),
    supabaseServer
      .from("salary_statements")
      .select("net_salary")
      .eq("month_key", monthKey),
    supabaseServer
      .from("teacher_journals")
      .select("id")
      .gte("created_at", rangeTs.fromTs)
      .lte("created_at", rangeTs.toTs),
    supabaseServer
      .from("naver_reservations")
      .select("id")
      .eq("status", "pending"),
    supabaseServer
      .from("kakao_reservations")
      .select("id")
      .eq("status", "pending"),
  ]);

  if (
    studentsRes.error ||
    paymentsRes.error ||
    attendanceRes.error ||
    salaryRes.error ||
    journalsRes.error ||
    naverRes.error ||
    kakaoRes.error
  ) {
    return NextResponse.json(
      {
        error:
          studentsRes.error?.message ??
          paymentsRes.error?.message ??
          attendanceRes.error?.message ??
          salaryRes.error?.message ??
          journalsRes.error?.message ??
          naverRes.error?.message ??
          kakaoRes.error?.message,
      },
      { status: 500 }
    );
  }

  const payments = paymentsRes.data ?? [];
  const attendance = attendanceRes.data ?? [];

  const totalRevenueTarget = payments.reduce((sum, p) => sum + (p.amount_due ?? 0), 0);
  const totalRevenuePaid = payments.reduce((sum, p) => sum + (p.amount_paid ?? 0), 0);
  const unpaidAmount = Math.max(totalRevenueTarget - totalRevenuePaid, 0);
  const unpaidCount = payments.filter((p) => p.status === "unpaid").length;

  const attended = attendance.filter((a) =>
    ["present", "late", "early_leave", "makeup"].includes(a.status)
  ).length;
  const attendanceRate =
    attendance.length > 0 ? Number(((attended / attendance.length) * 100).toFixed(1)) : 0;

  const makeupWaiting = attendance.filter((a) => a.status === "absent").length;
  const payrollTotal = (salaryRes.data ?? []).reduce(
    (sum: number, row: { net_salary: number | null }) => sum + (row.net_salary ?? 0),
    0
  );
  const journalCount = (journalsRes.data ?? []).length;
  const naverPendingCount = (naverRes.data ?? []).length;
  const kakaoPendingCount = (kakaoRes.data ?? []).length;

  return NextResponse.json({
    data: {
      studentsCount: studentsRes.count ?? 0,
      monthKey,
      totalRevenueTarget,
      totalRevenuePaid,
      unpaidAmount,
      unpaidCount,
      attendanceRate,
      makeupWaiting,
      payrollTotal,
      journalCount,
      naverPendingCount,
      kakaoPendingCount,
    },
  });
}
