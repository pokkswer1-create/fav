import { requireRole } from "@/lib/auth/guards";
import { monthRange, normalizeMonthKey } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function prevMonth(monthKey: string) {
  const mk = normalizeMonthKey(monthKey);
  const d = new Date(`${mk}-01T00:00:00`);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function last12Months(baseMonthKey: string) {
  const mk = normalizeMonthKey(baseMonthKey);
  const base = new Date(`${mk}-01T00:00:00`);
  return Array.from({ length: 12 }).map((_, idx) => {
    const d = new Date(base);
    d.setMonth(base.getMonth() - (11 - idx));
    return d.toISOString().slice(0, 7);
  });
}

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { searchParams } = new URL(request.url);
  const monthKey = normalizeMonthKey(searchParams.get("month") ?? new Date().toISOString().slice(0, 7));
  const previousMonthKey = prevMonth(monthKey);

  const currentRange = monthRange(monthKey);

  const [
    studentsRes,
    pendingStudentsRes,
    currentPaymentsRes,
    previousPaymentsRes,
    attendanceRes,
    classesRes,
    expensesRes,
  ] = await Promise.all([
    supabaseServer.from("students").select("id", { count: "exact", head: true }),
    supabaseServer.from("students").select("id", { count: "exact", head: true }).eq("status", "paused"),
    supabaseServer
      .from("payments")
      .select("amount_due, amount_paid, status")
      .eq("month_key", monthKey),
    supabaseServer
      .from("payments")
      .select("amount_paid")
      .eq("month_key", previousMonthKey),
    supabaseServer
      .from("attendance_records")
      .select("status")
      .gte("class_date", currentRange.from)
      .lte("class_date", currentRange.to),
    supabaseServer
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .gte("class_date", currentRange.from)
      .lte("class_date", currentRange.to),
    supabaseServer
      .from("expenses")
      .select("amount")
      .gte("expense_date", currentRange.from)
      .lte("expense_date", currentRange.to),
  ]);

  if (
    studentsRes.error ||
    pendingStudentsRes.error ||
    currentPaymentsRes.error ||
    previousPaymentsRes.error ||
    attendanceRes.error ||
    classesRes.error ||
    expensesRes.error
  ) {
    return NextResponse.json(
      {
        error:
          studentsRes.error?.message ??
          pendingStudentsRes.error?.message ??
          currentPaymentsRes.error?.message ??
          previousPaymentsRes.error?.message ??
          attendanceRes.error?.message ??
          classesRes.error?.message ??
          expensesRes.error?.message,
      },
      { status: 500 }
    );
  }

  const currentPayments = currentPaymentsRes.data ?? [];
  const previousPayments = previousPaymentsRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const thisMonthRevenue = currentPayments.reduce((sum, p) => sum + (p.amount_paid ?? 0), 0);
  const lastMonthRevenue = previousPayments.reduce((sum, p) => sum + (p.amount_paid ?? 0), 0);
  const memberCount = studentsRes.count ?? 0;
  const waitingMembers = pendingStudentsRes.count ?? 0;
  const completedCount = currentPayments.filter((p) => p.status === "paid").length;
  const unpaidAmount = currentPayments.reduce(
    (sum, p) => sum + Math.max((p.amount_due ?? 0) - (p.amount_paid ?? 0), 0),
    0
  );
  const unpaidCount = currentPayments.filter((p) => p.status === "unpaid").length;
  const totalCost = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const netProfit = thisMonthRevenue - totalCost;
  const absenceCount = attendance.filter((a) => a.status === "absent").length;
  const absenceRate = attendance.length
    ? Number(((absenceCount / attendance.length) * 100).toFixed(1))
    : 0;
  const makeupWaiting = absenceCount;
  const thisMonthUnpaidMembers = Math.max(memberCount - completedCount, 0);

  const classStatsRes = await supabaseServer
    .from("classes")
    .select("id, name, enrollments(id)");
  if (classStatsRes.error) {
    return NextResponse.json({ error: classStatsRes.error.message }, { status: 500 });
  }
  const classStats = (classStatsRes.data ?? []).map((klass) => ({
    classId: klass.id,
    className: klass.name,
    count: (klass.enrollments ?? []).length,
  }));

  const months = last12Months(monthKey);
  const monthlyData = await Promise.all(
    months.map(async (m) => {
      const range = monthRange(m);
      const [pRes, eRes] = await Promise.all([
        supabaseServer.from("payments").select("amount_paid").eq("month_key", m),
        supabaseServer.from("expenses").select("amount").gte("expense_date", range.from).lte("expense_date", range.to),
      ]);

      return {
        month: m,
        revenue: (pRes.data ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0),
        cost: (eRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0),
        members: memberCount,
      };
    })
  );

  return NextResponse.json({
    thisMonthRevenue,
    lastMonthRevenue,
    netProfit,
    memberCount,
    totalClasses: classesRes.count ?? 0,
    unpaidAmount,
    unpaidCount,
    waitingMembers,
    thisMonthPaid: completedCount,
    thisMonthUnpaidMembers,
    classStats,
    absenceRate,
    makeupWaiting,
    monthlyData: monthlyData.map((item) => ({
      ...item,
      profit: item.revenue - item.cost,
    })),
  });
}
