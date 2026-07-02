import { toApprovalStatus } from "@/lib/auth/approval-status";
import { sendApprovalEmail } from "@/lib/auth/approval-emails";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    return guard.response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const status = (searchParams.get("status")?.trim().toUpperCase() ?? "ALL") as
    | "ALL"
    | "PENDING"
    | "APPROVED"
    | "REJECTED";
  const from = searchParams.get("from")?.trim() ?? "";
  const to = searchParams.get("to")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));

  const supabase = getSupabaseServer();
  let listQuery = supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, organization, position, role, approval_status, approved, created_at, approved_at, approved_by, rejection_reason, reviewed_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (query) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    listQuery = listQuery.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }
  if (status !== "ALL") {
    listQuery = listQuery.eq("approval_status", status);
  }
  if (from) {
    listQuery = listQuery.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    listQuery = listQuery.lte("created_at", `${to}T23:59:59.999Z`);
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await listQuery.range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "PENDING"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "APPROVED"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "REJECTED"),
  ]);

  const items = (data ?? []).map((row) => ({
    ...row,
    approval_status: toApprovalStatus(row.approval_status, row.approved),
  }));

  return NextResponse.json({
    items,
    total: count ?? 0,
    page,
    pageSize,
    statusCounts: {
      PENDING: pendingCount.count ?? 0,
      APPROVED: approvedCount.count ?? 0,
      REJECTED: rejectedCount.count ?? 0,
    },
  });
}

export async function PATCH(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    return guard.response;
  }

  const body = await request.json().catch(() => ({}));
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.filter((v: unknown) => typeof v === "string" && v.trim())
    : [];
  const action = String(body?.action ?? "").toUpperCase();
  const targetRole = body?.role === "admin" ? "admin" : "teacher";
  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;

  if (userIds.length === 0) {
    return NextResponse.json({ error: "처리할 사용자 ID가 필요합니다." }, { status: 400 });
  }
  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "action은 APPROVE 또는 REJECT여야 합니다." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: targets, error: targetErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, approval_status, approved")
    .in("id", userIds);
  if (targetErr) {
    return NextResponse.json({ error: targetErr.message }, { status: 500 });
  }
  if (!targets || targets.length === 0) {
    return NextResponse.json({ error: "대상 사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const toStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
  const patch =
    action === "APPROVE"
      ? {
          approval_status: "APPROVED",
          approved: true,
          role: targetRole,
          approved_at: now,
          approved_by: guard.userId,
          reviewed_at: now,
          rejection_reason: null,
        }
      : {
          approval_status: "REJECTED",
          approved: false,
          approved_at: null,
          approved_by: null,
          reviewed_at: now,
          rejection_reason: reason,
        };

  const { error: updateErr } = await supabase.from("profiles").update(patch).in("id", userIds);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const events = targets.map((item) => ({
    user_id: item.id,
    actor_profile_id: guard.userId,
    from_status: toApprovalStatus(item.approval_status, item.approved),
    to_status: toStatus,
    reason,
  }));
  await supabase.from("user_approval_events").insert(events);

  const emailResults = await Promise.all(
    targets.map(async (item) => {
      const result = await sendApprovalEmail({
        to: item.email,
        fullName: item.full_name,
        kind: action === "APPROVE" ? "approved" : "rejected",
        rejectionReason: reason,
      });
      return { id: item.id, email: item.email ?? "", result };
    })
  );
  await supabase.from("user_email_notifications").insert(
    emailResults.map((item) => ({
      user_id: item.id,
      recipient_email: item.email,
      template_kind: action === "APPROVE" ? "approved" : "rejected",
      status: item.result.skipped ? "skipped" : item.result.ok ? "sent" : "failed",
      provider_message_id:
        "providerMessageId" in item.result ? item.result.providerMessageId : null,
      error_message: null,
    }))
  );

  return NextResponse.json({ ok: true, updatedCount: userIds.length });
}

