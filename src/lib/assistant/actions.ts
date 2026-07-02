import type { SupabaseClient } from "@supabase/supabase-js";
import { scrapeKVANotice } from "@/lib/external/kva";
import { mockNotificationProvider } from "@/lib/providers/notification/mock";
export async function notifyUnpaidAndPendingPayments(
  supabase: SupabaseClient,
  monthKey: string
): Promise<{ sent: number; failed: number; targetCount: number }> {
  const { data: rows, error } = await supabase
    .from("payments")
    .select("id, student_id, amount_due, amount_paid, status, students(name, parent_phone)")
    .eq("month_key", monthKey)
    .in("status", ["unpaid", "pending"]);

  if (error) throw new Error(error.message);

  const list = rows ?? [];
  let sent = 0;
  let failed = 0;

  for (const payment of list) {
    const st = payment.students as { name?: string; parent_phone?: string } | null;
    const studentName = st?.name ?? "학생";
    const parentPhone = st?.parent_phone?.trim() ?? "";
    if (!parentPhone) {
      failed += 1;
      continue;
    }
    await mockNotificationProvider.send({
      to: parentPhone,
      title: "결제 안내",
      body: `${studentName} 학생 ${monthKey} 수강료 결제 안내입니다. (미납/대기 건)`,
    });
    const { error: logErr } = await supabase.from("payment_reminders").insert({
      payment_id: payment.id,
      reminder_type: "manual",
      message: "센터 AI 일괄 발송",
    });
    if (logErr && !logErr.message.includes("does not exist")) {
      /* 테이블 없으면 발송만 반영 */
    }
    sent += 1;
  }

  return { sent, failed, targetCount: list.length };
}

export async function refreshKvaNotices(supabase: SupabaseClient): Promise<{ count: number; skipped: boolean }> {
  const notices = await scrapeKVANotice();
  if (notices.length === 0) {
    return { count: 0, skipped: false };
  }
  const payload = notices.map((notice) => ({
    source: "KVA",
    title: notice.title,
    link: notice.link,
    original_date: notice.originalDate,
    author: notice.author,
    scraped_at: new Date().toISOString(),
    is_active: true,
  }));
  const { error } = await supabase.from("external_notices").upsert(payload, { onConflict: "source,link" });
  if (error) {
    if (error.message.includes("external_notices") || error.message.includes("does not exist")) {
      return { count: 0, skipped: true };
    }
    throw new Error(error.message);
  }
  return { count: notices.length, skipped: false };
}

export async function pendingReservationsSummary(supabase: SupabaseClient): Promise<string> {
  const [naverRes, kakaoRes] = await Promise.all([
    supabase.from("naver_reservations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("kakao_reservations").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const parts: string[] = [];
  if (naverRes.error && !naverRes.error.message.includes("does not exist")) {
    parts.push(`네이버 예약 조회 오류: ${naverRes.error.message}`);
  } else {
    parts.push(`네이버 플레이스 예약 대기(pending): ${naverRes.count ?? 0}건`);
  }
  if (kakaoRes.error && !kakaoRes.error.message.includes("does not exist")) {
    parts.push(`카카오 예약 조회 오류: ${kakaoRes.error.message}`);
  } else {
    parts.push(`카카오채널 예약 대기(pending): ${kakaoRes.count ?? 0}건`);
  }
  return parts.join("\n");
}
