import type { CalendarEventDto } from "@/lib/calendar-types";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function seoulDateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function fmtTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

type ClassRow = { id: string; name: string; start_time?: string | null; end_time?: string | null };

function classSchedule(c: ClassRow | undefined): string | null {
  if (!c) return null;
  const a = fmtTime(c.start_time);
  const b = fmtTime(c.end_time);
  if (a && b) return `${a}~${b}`;
  return a;
}

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const y = Number(request.nextUrl.searchParams.get("year"));
  const m = Number(request.nextUrl.searchParams.get("month"));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: "year, month(1-12) 필요" }, { status: 400 });
  }

  const lastDay = new Date(y, m, 0).getDate();
  const start = `${y}-${pad2(m)}-01T00:00:00+09:00`;
  const end = `${y}-${pad2(m)}-${pad2(lastDay)}T23:59:59.999+09:00`;
  const dateStart = `${y}-${pad2(m)}-01`;
  const dateEnd = `${y}-${pad2(m)}-${pad2(lastDay)}`;

  const supabase = getSupabaseServer();
  const events: Record<string, CalendarEventDto[]> = {};

  function push(dateKey: string | null, ev: CalendarEventDto) {
    if (!dateKey) return;
    if (!events[dateKey]) events[dateKey] = [];
    events[dateKey].push(ev);
  }

  try {
    const [
      trialRes,
      regularAppRes,
      regularCounselRes,
      eliteAppRes,
      eliteTestRes,
      makeupAppRes,
      makeupPrefRes,
      classesRes,
      manualRes,
    ] = await Promise.all([
      supabase
        .from("trial_class_applications")
        .select("id, student_name, application_date, applied_class_id")
        .gte("application_date", start)
        .lte("application_date", end),
      supabase
        .from("regular_class_applications")
        .select("id, student_name, application_date, applied_class_id")
        .gte("application_date", start)
        .lte("application_date", end),
      supabase
        .from("regular_class_applications")
        .select("id, student_name, counseling_date, applied_class_id")
        .not("counseling_date", "is", null)
        .gte("counseling_date", start)
        .lte("counseling_date", end),
      supabase
        .from("elite_team_applications")
        .select("id, student_name, application_date")
        .gte("application_date", start)
        .lte("application_date", end),
      supabase
        .from("elite_team_applications")
        .select("id, student_name, test_date, test_time")
        .not("test_date", "is", null)
        .gte("test_date", dateStart)
        .lte("test_date", dateEnd),
      supabase
        .from("makeup_class_applications")
        .select("id, student_name, application_date, makeup_class_id")
        .gte("application_date", start)
        .lte("application_date", end),
      supabase
        .from("makeup_class_applications")
        .select("id, student_name, preferred_date, preferred_time, makeup_class_id")
        .not("preferred_date", "is", null)
        .gte("preferred_date", dateStart)
        .lte("preferred_date", dateEnd),
      supabase
        .from("classes")
        .select("id, name, class_type, created_at, start_time, end_time")
        .gte("created_at", start)
        .lte("created_at", end),
      supabase
        .from("staff_calendar_events")
        .select("*")
        .gte("event_date", dateStart)
        .lte("event_date", dateEnd),
    ]);

    const coreErrs = [
      trialRes.error,
      regularAppRes.error,
      regularCounselRes.error,
      eliteAppRes.error,
      eliteTestRes.error,
      makeupAppRes.error,
      makeupPrefRes.error,
      classesRes.error,
    ].filter(Boolean);

    if (coreErrs.length === 8) {
      return NextResponse.json({
        events: {},
        warning: coreErrs[0]?.message ?? "일정 테이블을 불러오지 못했습니다.",
      });
    }

    const classIds = new Set<string>();
    for (const row of trialRes.data ?? []) {
      if (row.applied_class_id) classIds.add(row.applied_class_id as string);
    }
    for (const row of regularAppRes.data ?? []) {
      if (row.applied_class_id) classIds.add(row.applied_class_id as string);
    }
    for (const row of regularCounselRes.data ?? []) {
      if (row.applied_class_id) classIds.add(row.applied_class_id as string);
    }
    for (const row of makeupAppRes.data ?? []) {
      if (row.makeup_class_id) classIds.add(row.makeup_class_id as string);
    }
    for (const row of makeupPrefRes.data ?? []) {
      if (row.makeup_class_id) classIds.add(row.makeup_class_id as string);
    }

    const classMap: Record<string, ClassRow> = {};
    if (classIds.size > 0) {
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, start_time, end_time")
        .in("id", [...classIds]);
      for (const c of cls ?? []) {
        classMap[c.id as string] = c as ClassRow;
      }
    }

    for (const row of trialRes.data ?? []) {
      const cid = row.applied_class_id as string | null;
      const c = cid ? classMap[cid] : undefined;
      push(seoulDateKeyFromIso(row.application_date as string), {
        id: `trial-${row.id}`,
        source: "trial",
        category: "체험 수업",
        studentName: row.student_name as string,
        className: c?.name ?? null,
        time: classSchedule(c),
        note: null,
        deletable: false,
      });
    }

    for (const row of regularAppRes.data ?? []) {
      const cid = row.applied_class_id as string | null;
      const c = cid ? classMap[cid] : undefined;
      push(seoulDateKeyFromIso(row.application_date as string), {
        id: `regular-${row.id}`,
        source: "regular",
        category: "정규 수업",
        studentName: row.student_name as string,
        className: c?.name ?? null,
        time: classSchedule(c),
        note: null,
        deletable: false,
      });
    }

    for (const row of regularCounselRes.data ?? []) {
      const cid = row.applied_class_id as string | null;
      const c = cid ? classMap[cid] : undefined;
      push(seoulDateKeyFromIso(row.counseling_date as string), {
        id: `counsel-${row.id}`,
        source: "counseling",
        category: "정규 상담",
        studentName: row.student_name as string,
        className: c?.name ?? null,
        time: classSchedule(c),
        note: null,
        deletable: false,
      });
    }

    for (const row of eliteAppRes.data ?? []) {
      push(seoulDateKeyFromIso(row.application_date as string), {
        id: `elite-app-${row.id}`,
        source: "elite_app",
        category: "대표팀 신청",
        studentName: row.student_name as string,
        className: null,
        time: null,
        note: null,
        deletable: false,
      });
    }

    for (const row of eliteTestRes.data ?? []) {
      const td = (row.test_date as string).slice(0, 10);
      push(td, {
        id: `elite-test-${row.id}`,
        source: "elite_test",
        category: "대표팀 테스트",
        studentName: row.student_name as string,
        className: null,
        time: fmtTime(row.test_time),
        note: null,
        deletable: false,
      });
    }

    for (const row of makeupAppRes.data ?? []) {
      const cid = row.makeup_class_id as string | null;
      const c = cid ? classMap[cid] : undefined;
      push(seoulDateKeyFromIso(row.application_date as string), {
        id: `makeup-app-${row.id}`,
        source: "makeup_app",
        category: "보강 접수",
        studentName: row.student_name as string,
        className: c?.name ?? null,
        time: classSchedule(c),
        note: null,
        deletable: false,
      });
    }

    for (const row of makeupPrefRes.data ?? []) {
      const cid = row.makeup_class_id as string | null;
      const c = cid ? classMap[cid] : undefined;
      const pd = (row.preferred_date as string).slice(0, 10);
      push(pd, {
        id: `makeup-pref-${row.id}`,
        source: "makeup_pref",
        category: "보강 희망",
        studentName: row.student_name as string,
        className: c?.name ?? null,
        time: fmtTime(row.preferred_time) ?? classSchedule(c),
        note: null,
        deletable: false,
      });
    }

    for (const row of classesRes.data ?? []) {
      const key = seoulDateKeyFromIso(row.created_at as string);
      const typeLabel =
        row.class_type === "trial" ? "체험 반" : row.class_type === "regular" ? "정규 반" : "수업";
      push(key, {
        id: `class-new-${row.id}-${key}`,
        source: "class_new",
        category: `신규 ${typeLabel}`,
        studentName: null,
        className: row.name as string,
        time: classSchedule(row as ClassRow),
        note: null,
        deletable: false,
      });
    }

    if (!manualRes.error) {
      for (const row of manualRes.data ?? []) {
        const dk = (row.event_date as string).slice(0, 10);
        push(dk, {
          id: `manual-${row.id}`,
          source: "manual",
          category: row.category as string,
          studentName: (row.student_name as string) ?? null,
          className: (row.class_name as string) ?? null,
          time: fmtTime(row.event_time),
          note: (row.note as string) ?? null,
          deletable: true,
        });
      }
    }

    const warnings: string[] = [];
    if (manualRes.error) {
      warnings.push("수동 일정 테이블(staff_calendar_events)이 없거나 접근할 수 없습니다.");
    }

    return NextResponse.json({ events, warnings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message, events: {} }, { status: 500 });
  }
}
