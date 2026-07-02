import { toApprovalStatus } from "@/lib/auth/approval-status";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import type { UserRole } from "@/lib/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type GuardSuccess = {
  ok: true;
  userId: string;
  role: UserRole;
};

type GuardFail = {
  ok: false;
  response: NextResponse;
};

export async function requireRole(allowedRoles: UserRole[]): Promise<GuardSuccess | GuardFail> {
  const bypassAuth = (process.env.NEXT_PUBLIC_BYPASS_AUTH ?? "").trim().toLowerCase() === "true";
  if (bypassAuth) {
    return {
      ok: true,
      userId: "dev-bypass-user",
      role: allowedRoles.includes("admin") ? "admin" : "teacher",
    };
  }

  const h = await headers();
  const authHeader = h.get("authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;

  if (!bearer) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "로그인이 필요합니다. /auth 에서 로그인한 뒤 다시 시도하세요." },
        { status: 401 }
      ),
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      ok: false,
      response: NextResponse.json({ error: "서버 환경 변수가 설정되지 않았습니다." }, { status: 500 }),
    };
  }

  const authClient = createClient(url, anon);
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser(bearer);

  if (authErr || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "세션이 만료되었거나 유효하지 않습니다. 다시 로그인하세요." },
        { status: 401 }
      ),
    };
  }

  const supabase = getSupabaseServer();

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, approved, approval_status, rejection_reason")
    .eq("id", user.id)
    .maybeSingle();

  // 첫 로그인 사용자는 프로필을 자동 생성해 접근 오류를 방지
  if (!profile && !profileError) {
    const bootstrapAdmin = isBootstrapAdminEmail(user.email);
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

    const now = new Date().toISOString();
    const insertPayload = {
      id: user.id,
      full_name: fullName,
      email: user.email ?? null,
      phone,
      organization,
      position,
      role: bootstrapAdmin ? "admin" : "teacher",
      approval_status: bootstrapAdmin ? "APPROVED" : "PENDING",
      approved: bootstrapAdmin,
      approved_at: bootstrapAdmin ? now : null,
      reviewed_at: bootstrapAdmin ? now : null,
      rejection_reason: null,
    };

    const created = await supabase.from("profiles").insert(insertPayload);
    if (!created.error) {
      profile = {
        role: insertPayload.role,
        approved: insertPayload.approved,
        approval_status: insertPayload.approval_status,
        rejection_reason: null,
      };
    } else {
      profileError = created.error;
    }
  }

  // 과거 데이터(역할 누락) 자동 복구
  if (profile && !profile.role) {
    const bootstrapAdmin = isBootstrapAdminEmail(user.email);
    const nextRole: UserRole = bootstrapAdmin ? "admin" : "teacher";
    const nextApprovalStatus =
      typeof profile.approval_status === "string" && profile.approval_status.trim()
        ? profile.approval_status
        : bootstrapAdmin
          ? "APPROVED"
          : "PENDING";
    const now = new Date().toISOString();

    const recoveryPayload = {
      role: nextRole,
      approval_status: nextApprovalStatus,
      approved: nextApprovalStatus === "APPROVED",
      approved_at: nextApprovalStatus === "APPROVED" ? now : null,
      reviewed_at: nextApprovalStatus === "APPROVED" ? now : null,
    };

    const recovered = await supabase
      .from("profiles")
      .update(recoveryPayload)
      .eq("id", user.id)
      .select("role, approved, approval_status, rejection_reason")
      .maybeSingle();

    if (!recovered.error && recovered.data) {
      profile = recovered.data;
      profileError = null;
    } else if (recovered.error) {
      profileError = recovered.error;
    }
  }

  if (profileError || !profile?.role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: profileError?.message ?? "프로필 권한(role) 정보가 없습니다. 관리자에게 문의해 주세요." },
        { status: 403 }
      ),
    };
  }

  const approvalStatus = toApprovalStatus(profile.approval_status, profile.approved);
  if (approvalStatus !== "APPROVED") {
    const errorMessage =
      approvalStatus === "REJECTED"
        ? "회원가입이 반려되어 접근할 수 없습니다. 관리자에게 문의해 주세요."
        : "관리자 승인 대기중입니다.";
    return {
      ok: false,
      response: NextResponse.json(
        { error: errorMessage, approvalStatus, rejectionReason: profile.rejection_reason ?? null },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(profile.role as UserRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: profile.role as UserRole,
  };
}
