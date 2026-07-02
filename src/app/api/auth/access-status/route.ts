import { toApprovalStatus } from "@/lib/auth/approval-status";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import { sendApprovalEmail } from "@/lib/auth/approval-emails";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
  if (!bearer) {
    return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Supabase 환경변수가 필요합니다." }, { status: 500 });
  }

  const authClient = createClient(url, anon);
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser(bearer);
  if (userErr || !user) {
    return NextResponse.json({ error: "유효하지 않은 세션입니다." }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, role, approved, approval_status, rejection_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  if (!profile) {
    const metadata = user.user_metadata ?? {};
    const fullName =
      typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : (user.email || "new-user").split("@")[0];
    const phone =
      typeof metadata.phone === "string" && metadata.phone.trim() ? metadata.phone.trim() : null;
    const organization =
      typeof metadata.organization === "string" && metadata.organization.trim()
        ? metadata.organization.trim()
        : null;
    const position =
      typeof metadata.position === "string" && metadata.position.trim() ? metadata.position.trim() : null;
    const bootstrapAdmin = isBootstrapAdminEmail(user.email);
    const approvalStatus = bootstrapAdmin ? "APPROVED" : "PENDING";
    const now = new Date().toISOString();
    const createPayload = {
      id: user.id,
      full_name: fullName,
      email: user.email ?? null,
      phone,
      organization,
      position,
      role: bootstrapAdmin ? "admin" : "teacher",
      approval_status: approvalStatus,
      approved: bootstrapAdmin,
      approved_at: bootstrapAdmin ? now : null,
      reviewed_at: bootstrapAdmin ? now : null,
      approved_by: null,
      rejection_reason: null,
    };
    const createErr = (await supabase.from("profiles").insert(createPayload)).error;
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    if (!bootstrapAdmin) {
      const emailResult = await sendApprovalEmail({
        to: user.email ?? null,
        fullName,
        kind: "submitted",
      });
      await supabase.from("user_email_notifications").insert({
        user_id: user.id,
        recipient_email: user.email ?? "",
        template_kind: "submitted",
        status: emailResult.skipped ? "skipped" : emailResult.ok ? "sent" : "failed",
        provider_message_id: "providerMessageId" in emailResult ? emailResult.providerMessageId : null,
        error_message: null,
      });
    }

    return NextResponse.json({
      approved: bootstrapAdmin,
      approvalStatus,
      role: bootstrapAdmin ? "admin" : "teacher",
      rejectionReason: null,
      email: user.email ?? null,
    });
  }

  const bootstrapAdmin = isBootstrapAdminEmail(user.email);
  const profileStatus = toApprovalStatus(profile.approval_status, profile.approved);
  if (bootstrapAdmin && (profile.role !== "admin" || profileStatus !== "APPROVED")) {
    const updatePayload = {
      role: "admin",
      approval_status: "APPROVED",
      approved: true,
      approved_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    };
    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select("role, approved, approval_status, rejection_reason")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "프로필 갱신 결과를 찾지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      approved: toApprovalStatus(updated.approval_status, updated.approved) === "APPROVED",
      approvalStatus: toApprovalStatus(updated.approval_status, updated.approved),
      role: updated.role,
      rejectionReason: updated.rejection_reason ?? null,
      email: user.email ?? null,
    });
  }

  const approvalStatus = toApprovalStatus(profile.approval_status, profile.approved);
  return NextResponse.json({
    approved: approvalStatus === "APPROVED",
    approvalStatus,
    role: profile.role,
    rejectionReason: profile.rejection_reason ?? null,
    email: user.email ?? null,
  });
}

