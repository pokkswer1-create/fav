import { toApprovalStatus } from "@/lib/auth/approval-status";
import { sendApprovalEmail } from "@/lib/auth/approval-emails";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    return guard.response;
  }

  const { userId } = await params;
  const body = await request.json().catch(() => ({}));
  const approve = Boolean(body?.approve);
  const role = body?.role === "admin" ? "admin" : "teacher";
  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;

  const supabase = getSupabaseServer();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, full_name, email, approval_status, approved")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "대상 사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const toStatus = approve ? "APPROVED" : "REJECTED";
  const { error } = await supabase
    .from("profiles")
    .update({
      approval_status: toStatus,
      approved: approve,
      role,
      approved_at: approve ? now : null,
      approved_by: approve ? guard.userId : null,
      rejection_reason: approve ? null : reason,
      reviewed_at: now,
    })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("user_approval_events").insert({
    user_id: userId,
    actor_profile_id: guard.userId,
    from_status: toApprovalStatus(target.approval_status, target.approved),
    to_status: toStatus,
    reason,
  });

  const emailResult = await sendApprovalEmail({
    to: target.email,
    fullName: target.full_name,
    kind: approve ? "approved" : "rejected",
    rejectionReason: reason,
  });
  await supabase.from("user_email_notifications").insert({
    user_id: userId,
    recipient_email: target.email ?? "",
    template_kind: approve ? "approved" : "rejected",
    status: emailResult.skipped ? "skipped" : emailResult.ok ? "sent" : "failed",
    provider_message_id: "providerMessageId" in emailResult ? emailResult.providerMessageId : null,
    error_message: null,
  });

  return NextResponse.json({ ok: true });
}

