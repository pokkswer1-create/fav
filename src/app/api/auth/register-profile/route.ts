import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import { sendApprovalEmail } from "@/lib/auth/approval-emails";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function sanitize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const fullName = sanitize(body?.fullName);
  const phone = sanitize(body?.phone);
  const organization = sanitize(body?.organization);
  const position = sanitize(body?.position);

  if (!fullName || !phone) {
    return NextResponse.json({ error: "이름과 연락처는 필수입니다." }, { status: 400 });
  }

  const bootstrapAdmin = isBootstrapAdminEmail(user.email);
  const profilePayload = {
    id: user.id,
    full_name: fullName,
    email: user.email ?? null,
    phone,
    organization: organization || null,
    position: position || null,
    role: bootstrapAdmin ? "admin" : "teacher",
    approval_status: bootstrapAdmin ? "APPROVED" : "PENDING",
    approved: bootstrapAdmin,
    approved_at: bootstrapAdmin ? new Date().toISOString() : null,
    approved_by: null,
    rejection_reason: null,
    reviewed_at: bootstrapAdmin ? new Date().toISOString() : null,
  };

  const supabase = getSupabaseServer();
  const { error: upsertErr } = await supabase.from("profiles").upsert(profilePayload, {
    onConflict: "id",
  });
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
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

  return NextResponse.json({ ok: true, approvalStatus: profilePayload.approval_status });
}

