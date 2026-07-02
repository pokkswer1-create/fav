import type { SupabaseClient } from "@supabase/supabase-js";
import { koreaDateString, koreaWeekdayKey, normalizeTimeToHM } from "@/lib/datetime/korea";

const PRESENT_LIKE = new Set(["present", "late", "early_leave", "makeup"]);

export type ClassAttendanceSnapshot = {
  classId: string;
  name: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  enrolledCount: number;
  presentCount: number;
  absentCount: number;
  unmarkedCount: number;
  absentNames: string[];
  unmarkedNames: string[];
};

export type TodayAttendanceSnapshot = {
  date: string;
  weekdayKey: string;
  classes: ClassAttendanceSnapshot[];
};

export async function getTodayAttendanceSnapshot(
  supabase: SupabaseClient
): Promise<TodayAttendanceSnapshot> {
  const date = koreaDateString();
  const weekdayKey = koreaWeekdayKey();

  const { data: classes, error: cErr } = await supabase
    .from("classes")
    .select("id, name, teacher_name, start_time, end_time, days_of_week, class_status")
    .eq("class_status", "active")
    .contains("days_of_week", [weekdayKey]);

  if (cErr) throw new Error(cErr.message);
  const classList = classes ?? [];
  if (classList.length === 0) {
    return { date, weekdayKey, classes: [] };
  }

  const classIds = classList.map((c) => c.id);

  const { data: enrollRows, error: eErr } = await supabase
    .from("enrollments")
    .select("class_id, student_id, students(name)")
    .in("class_id", classIds);

  if (eErr) throw new Error(eErr.message);

  const { data: attRows, error: aErr } = await supabase
    .from("attendance_records")
    .select("class_id, student_id, status")
    .eq("class_date", date)
    .in("class_id", classIds);

  if (aErr) throw new Error(aErr.message);

  const enrollByClass = new Map<string, { studentId: string; name: string }[]>();
  for (const row of enrollRows ?? []) {
    const sid = row.student_id as string;
    const name =
      (row.students as { name?: string } | null)?.name?.trim() || "이름없음";
    const list = enrollByClass.get(row.class_id as string) ?? [];
    list.push({ studentId: sid, name });
    enrollByClass.set(row.class_id as string, list);
  }

  const attByClassStudent = new Map<string, string>();
  for (const row of attRows ?? []) {
    const key = `${row.class_id}:${row.student_id}`;
    attByClassStudent.set(key, row.status as string);
  }

  const classesOut: ClassAttendanceSnapshot[] = classList.map((c) => {
    const enrolled = enrollByClass.get(c.id) ?? [];
    let presentCount = 0;
    let absentCount = 0;
    let unmarkedCount = 0;
    const absentNames: string[] = [];
    const unmarkedNames: string[] = [];

    for (const s of enrolled) {
      const st = attByClassStudent.get(`${c.id}:${s.studentId}`);
      if (!st) {
        unmarkedCount += 1;
        unmarkedNames.push(s.name);
      } else if (st === "absent") {
        absentCount += 1;
        absentNames.push(s.name);
      } else if (PRESENT_LIKE.has(st)) {
        presentCount += 1;
      } else {
        unmarkedCount += 1;
        unmarkedNames.push(s.name);
      }
    }

    return {
      classId: c.id,
      name: c.name,
      teacherName: c.teacher_name,
      startTime: normalizeTimeToHM(String(c.start_time)),
      endTime: normalizeTimeToHM(String(c.end_time)),
      enrolledCount: enrolled.length,
      presentCount,
      absentCount,
      unmarkedCount,
      absentNames,
      unmarkedNames,
    };
  });

  classesOut.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return { date, weekdayKey, classes: classesOut };
}

export function formatTodayDigest(snapshot: TodayAttendanceSnapshot): string {
  if (snapshot.classes.length === 0) {
    return `오늘(${snapshot.date})은 시간표상 진행 중인 반이 없습니다.`;
  }
  const lines: string[] = [`오늘(${snapshot.date}) 출석 요약`];
  for (const c of snapshot.classes) {
    const abs =
      c.absentNames.length > 0 ? c.absentNames.join(", ") : "없음";
    lines.push(
      `· ${c.name} (${c.startTime}): 결석 ${c.absentCount}명 (${abs}), 출석·지각·보강 등 ${c.presentCount}명, 미입력 ${c.unmarkedCount}명`
    );
  }
  return lines.join("\n");
}

export function formatClassSlotMessage(c: ClassAttendanceSnapshot): string {
  const abs = c.absentNames.length ? c.absentNames.join(", ") : "없음";
  return `${c.name} (${c.startTime}) — 출석 ${c.presentCount}명, 결석 ${c.absentCount}명 (결석: ${abs}), 미입력 ${c.unmarkedCount}명`;
}
