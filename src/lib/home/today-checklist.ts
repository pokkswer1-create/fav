import type { SupabaseClient } from "@supabase/supabase-js";
import { koreaDateString } from "@/lib/datetime/korea";
import { getTodayAttendanceSnapshot } from "@/lib/home/attendance-snapshot";

export type ChecklistSeverity = "warning" | "info" | "success";

export type ChecklistItem = {
  id: string;
  severity: ChecklistSeverity;
  title: string;
  detail?: string;
  href?: string;
};

export type TodayChecklistPayload = {
  date: string;
  monthKey: string;
  items: ChecklistItem[];
};

function namesPreview(names: string[], max = 6): string {
  if (names.length === 0) return "";
  const slice = names.slice(0, max);
  const more = names.length > max ? ` 외 ${names.length - max}명` : "";
  return `${slice.join(", ")}${more}`;
}

export async function buildTodayChecklist(supabase: SupabaseClient): Promise<TodayChecklistPayload> {
  const date = koreaDateString();
  const monthKey = date.slice(0, 7);
  const items: ChecklistItem[] = [];

  try {
    const snap = await getTodayAttendanceSnapshot(supabase);
    if (snap.classes.length === 0) {
      items.push({
        id: "no-class-today",
        severity: "info",
        title: "오늘은 시간표상 진행 중인 반이 없습니다.",
        href: "/classes",
      });
    } else {
      for (const c of snap.classes) {
        if (c.unmarkedCount > 0) {
          items.push({
            id: `att-unmarked-${c.classId}`,
            severity: "warning",
            title: `[출석] ${c.name} (${c.startTime}) — 미입력 ${c.unmarkedCount}명`,
            detail: namesPreview(c.unmarkedNames) || "수강생 출석을 입력해 주세요.",
            href: "/attendance",
          });
        }
        if (c.absentCount > 0) {
          items.push({
            id: `att-absent-${c.classId}`,
            severity: "info",
            title: `[결석] ${c.name} — 결석 ${c.absentCount}명`,
            detail: namesPreview(c.absentNames),
            href: "/attendance",
          });
        }
      }
    }
  } catch {
    items.push({
      id: "attendance-load-fail",
      severity: "info",
      title: "오늘 수업·출석 요약을 불러오지 못했습니다.",
      detail: "출석 메뉴에서 직접 확인해 주세요.",
      href: "/attendance",
    });
  }

  const { count: payCount, error: payErr } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("month_key", monthKey)
    .in("status", ["unpaid", "pending"]);

  if (!payErr && (payCount ?? 0) > 0) {
    items.push({
      id: "payments-pending",
      severity: "warning",
      title: `[결제] 이번 달 미납·결제대기 ${payCount}건`,
      detail: "독촉·결제 안내가 필요할 수 있습니다.",
      href: "/payments",
    });
  }

  const [naverRes, kakaoRes] = await Promise.all([
    supabase.from("naver_reservations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("kakao_reservations").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const naverN = naverRes.error ? null : (naverRes.count ?? 0);
  const kakaoN = kakaoRes.error ? null : (kakaoRes.count ?? 0);
  if (naverN !== null && naverN > 0) {
    items.push({
      id: "naver-pending",
      severity: "info",
      title: `[예약] 네이버 플레이스 확인 대기 ${naverN}건`,
      href: "/naver-reservations",
    });
  }
  if (kakaoN !== null && kakaoN > 0) {
    items.push({
      id: "kakao-pending",
      severity: "info",
      title: `[예약] 카카오채널 확인 대기 ${kakaoN}건`,
      href: "/kakao-reservations",
    });
  }

  const dayStart = `${date}T00:00:00+09:00`;
  const dayEnd = `${date}T23:59:59.999+09:00`;
  const { count: igCount, error: igErr } = await supabase
    .from("instagram_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "scheduled")
    .gte("scheduled_time", dayStart)
    .lte("scheduled_time", dayEnd);

  if (!igErr && (igCount ?? 0) > 0) {
    items.push({
      id: "instagram-scheduled",
      severity: "info",
      title: `[인스타] 오늘 예약 게시 ${igCount}건`,
      detail: "예약 발행 시간을 확인해 주세요.",
      href: "/instagram",
    });
  }

  const hasWarning = items.some((i) => i.severity === "warning");
  if (!hasWarning) {
    const onlyNoClass = items.length === 1 && items[0].id === "no-class-today";
    if (!onlyNoClass) {
      items.push({
        id: "all-clear",
        severity: "success",
        title: "출석 미입력·이번 달 미납/결제대기 등 긴급 항목은 없습니다.",
      });
    }
  }

  return { date, monthKey, items };
}
