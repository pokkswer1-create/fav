import { requireRole } from "@/lib/auth/guards";
import {
  getFeesForTier,
  isClassFeeTierId,
  type ClassFeeTierId,
} from "@/lib/class-fee-tiers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("classes")
    .select("*, enrollments(id, student_id, students(id, name, grade))")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const body = await request.json();
  const feeTierRaw = body.fee_tier as string | undefined;

  let monthlySessions: number;
  let feeMode = (body.fee_mode ?? "monthly_fixed") as "monthly_fixed" | "per_session";
  let feePerSession = Number(body.fee_per_session ?? 0);
  let monthlyFee: number;
  let classCategory: "general" | "elite" | "tryout";

  if (feeTierRaw && isClassFeeTierId(feeTierRaw)) {
    const t = getFeesForTier(feeTierRaw as ClassFeeTierId);
    monthlyFee = t.monthly_fee;
    monthlySessions = t.monthly_sessions;
    classCategory = t.class_category;
    feeMode = "monthly_fixed";
    feePerSession = 0;
  } else {
    monthlySessions = Number(body.monthly_sessions ?? 0);
    monthlyFee =
      feeMode === "per_session"
        ? feePerSession * monthlySessions
        : Number(body.monthly_fee ?? 0);
    classCategory = (body.class_category ?? "general") as "general" | "elite" | "tryout";
  }

  if (monthlyFee <= 0) {
    return NextResponse.json(
      { error: "요금 구간(fee_tier)을 선택하거나 유효한 수강료가 필요합니다." },
      { status: 400 }
    );
  }

  const payload = {
    name: body.name,
    teacher_name: body.teacher_name,
    class_type: body.class_type,
    class_category: classCategory,
    days_of_week: body.days_of_week ?? [],
    start_time: body.start_time,
    end_time: body.end_time,
    fee_mode: feeMode,
    fee_per_session: feePerSession,
    monthly_fee: monthlyFee,
    monthly_sessions: monthlySessions,
    capacity: Number(body.capacity ?? 0),
    is_active: body.is_active ?? true,
    class_status: body.class_status ?? "active",
  };

  const { data, error } = await supabaseServer
    .from("classes")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
