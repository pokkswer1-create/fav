import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const LIMIT = 200;

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseServer();

  const [trialRes, regularRes, eliteRes, makeupRes] = await Promise.all([
    supabase
      .from("trial_class_applications")
      .select("*")
      .order("application_date", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("regular_class_applications")
      .select("*")
      .order("application_date", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("elite_team_applications")
      .select("*")
      .order("application_date", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("makeup_class_applications")
      .select("*")
      .order("application_date", { ascending: false })
      .limit(LIMIT),
  ]);

  const errs = [trialRes.error, regularRes.error, eliteRes.error, makeupRes.error].filter(Boolean);
  if (errs.length === 4) {
    return NextResponse.json(
      { error: errs[0]?.message ?? "신청 테이블을 불러올 수 없습니다.", trials: [], regulars: [], elites: [], makeups: [] },
      { status: 500 }
    );
  }

  const classIds = new Set<string>();
  for (const row of trialRes.data ?? []) {
    if (row.applied_class_id) classIds.add(row.applied_class_id as string);
  }
  for (const row of regularRes.data ?? []) {
    if (row.applied_class_id) classIds.add(row.applied_class_id as string);
  }
  for (const row of makeupRes.data ?? []) {
    if (row.makeup_class_id) classIds.add(row.makeup_class_id as string);
  }

  let classMap: Record<string, string> = {};
  if (classIds.size > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", [...classIds]);
    classMap = Object.fromEntries((classes ?? []).map((c) => [c.id as string, c.name as string]));
  }

  return NextResponse.json({
    trials: trialRes.data ?? [],
    regulars: regularRes.data ?? [],
    elites: eliteRes.data ?? [],
    makeups: makeupRes.data ?? [],
    classNames: classMap,
    partialErrors: errs.map((e) => e?.message).filter(Boolean),
  });
}
