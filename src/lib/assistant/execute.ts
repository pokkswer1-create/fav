import type { SupabaseClient } from "@supabase/supabase-js";
import {
  notifyUnpaidAndPendingPayments,
  pendingReservationsSummary,
  refreshKvaNotices,
} from "@/lib/assistant/actions";
import {
  getTodayAttendanceSnapshot,
  formatTodayDigest,
} from "@/lib/home/attendance-snapshot";
import { monthKeyFromRef, type ClassifiedQuery } from "@/lib/assistant/intent";
import { monthRange } from "@/lib/month-range";

export type AssistantContext = { role: "admin" | "teacher" };

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export async function executeAssistantQuery(
  supabase: SupabaseClient,
  q: ClassifiedQuery,
  ctx: AssistantContext
): Promise<string> {
  const monthKey = monthKeyFromRef(q.monthRef);
  const range = monthRange(monthKey);

  switch (q.topic) {
    case "absence_today": {
      const snap = await getTodayAttendanceSnapshot(supabase);
      return formatTodayDigest(snap);
    }
    case "revenue": {
      const { data, error } = await supabase
        .from("payments")
        .select("amount_paid")
        .eq("month_key", monthKey);
      if (error) throw new Error(error.message);
      const total = (data ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0);
      return `${monthKey} 기준 실제 입금된 수강료(결제 완료 합계)는 ${won(total)}입니다. (미납은 별도 항목으로 확인하세요.)`;
    }
    case "unpaid": {
      const { data, error } = await supabase
        .from("payments")
        .select("amount_due, amount_paid, status")
        .eq("month_key", monthKey);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const unpaidAmount = rows.reduce(
        (s, p) => s + Math.max((p.amount_due ?? 0) - (p.amount_paid ?? 0), 0),
        0
      );
      const unpaidCount = rows.filter((p) => p.status === "unpaid").length;
      return `${monthKey} 미납 건수는 ${unpaidCount}건이며, 미수금(청구−입금) 합계는 약 ${won(unpaidAmount)}입니다.`;
    }
    case "unpaid_list": {
      const { data, error } = await supabase
        .from("payments")
        .select("status, amount_due, amount_paid, students(name)")
        .eq("month_key", monthKey)
        .in("status", ["unpaid", "pending"]);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      if (rows.length === 0) {
        return `${monthKey} 기준 미납·결제대기(pending) 건이 없습니다.`;
      }
      const lines = rows.map((p, i) => {
        const name = (p.students as { name?: string } | null)?.name ?? "이름없음";
        const due = Math.max((p.amount_due ?? 0) - (p.amount_paid ?? 0), 0);
        return `${i + 1}. ${name} (${p.status}) 잔액 약 ${won(due)}`;
      });
      return `${monthKey} 미납·대기 ${rows.length}건:\n${lines.join("\n")}`;
    }
    case "pending_reservations": {
      return await pendingReservationsSummary(supabase);
    }
    case "action_notify_unpaid": {
      if (ctx.role !== "admin") {
        return "미납·결제대기 학부모에게 결제 안내를 보내는 작업은 관리자(원장) 권한에서만 실행할 수 있습니다.";
      }
      const { sent, failed, targetCount } = await notifyUnpaidAndPendingPayments(supabase, monthKey);
      return `${monthKey} 기준 미납·결제대기 ${targetCount}건 중 모의 알림 발송 완료 ${sent}건, 실패(연락처 없음 등) ${failed}건입니다. (실제 카카오/문자 연동 시 프로바이더 설정 필요)`;
    }
    case "action_refresh_kva": {
      if (ctx.role !== "admin") {
        return "KVA 공지 동기화는 관리자(원장) 권한에서만 실행할 수 있습니다.";
      }
      const { count, skipped } = await refreshKvaNotices(supabase);
      if (skipped) {
        return "KVA 공지를 저장할 테이블이 없거나 스키마가 준비되지 않았습니다. Supabase에 external_notices를 적용해 주세요.";
      }
      return `KVA 공지를 다시 가져왔습니다. 처리된 공지 ${count}건입니다.`;
    }
    case "absence_month": {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("status")
        .gte("class_date", range.from)
        .lte("class_date", range.to);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const absenceCount = rows.filter((r) => r.status === "absent").length;
      const total = rows.length;
      const rate =
        total > 0 ? ((absenceCount / total) * 100).toFixed(1) : "0.0";
      return `${monthKey} 출석 기록 ${total}건 중 결석은 ${absenceCount}건입니다. (전체 대비 약 ${rate}%)`;
    }
    case "members": {
      const { count, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `등록된 회원(학생) 수는 ${count ?? 0}명입니다.`;
    }
    case "attendance_rate": {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("status")
        .gte("class_date", range.from)
        .lte("class_date", range.to);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const attended = rows.filter((r) =>
        ["present", "late", "early_leave", "makeup"].includes(r.status as string)
      ).length;
      const rate =
        rows.length > 0 ? ((attended / rows.length) * 100).toFixed(1) : "0.0";
      return `${monthKey} 출석 기록 기준 출석률(출석·지각·조퇴·보강 포함)은 약 ${rate}%입니다. (${attended}/${rows.length}건)`;
    }
    case "profit": {
      const [payRes, expRes] = await Promise.all([
        supabase.from("payments").select("amount_paid").eq("month_key", monthKey),
        supabase
          .from("expenses")
          .select("amount")
          .gte("expense_date", range.from)
          .lte("expense_date", range.to),
      ]);
      if (payRes.error) throw new Error(payRes.error.message);
      if (expRes.error) throw new Error(expRes.error.message);
      const revenue = (payRes.data ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0);
      const cost = (expRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const net = revenue - cost;
      return `${monthKey} 입금 ${won(revenue)}, 비용 ${won(cost)}, 차감 후 ${won(net)}입니다. (간이 순이익)`;
    }
    case "summary": {
      const [rev, absSnap, unpaidT] = await Promise.all([
        executeAssistantQuery(supabase, { topic: "revenue", monthRef: q.monthRef }, ctx),
        executeAssistantQuery(supabase, { topic: "absence_month", monthRef: q.monthRef }, ctx),
        executeAssistantQuery(supabase, { topic: "unpaid", monthRef: q.monthRef }, ctx),
      ]);
      const mem = await executeAssistantQuery(supabase, {
        topic: "members",
        monthRef: q.monthRef,
      }, ctx);
      return [rev, unpaidT, absSnap, mem].join("\n");
    }
    default:
      return `질문을 이해하지 못했습니다. 예: "이번 달 매출 알려줘", "미납자 이름 알려줘", "미납자에게 결제 안내 보내줘"(관리자), "KVA 공지 갱신해줘"(관리자), "예약 대기 몇 건이야?"`;
  }
}
