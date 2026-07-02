function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function normalizeId(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/**
 * SUPER_ADMIN_EMAIL과 로그인 이메일이 일치하면 최초 관리자 부트스트랩 대상으로 본다.
 * 추가로 APPROVER_ADMIN_ID와 이메일 로컬파트가 일치하면 관리자 부트스트랩으로 본다.
 */
export function isBootstrapAdminEmail(email: string | null | undefined) {
  const configured = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
  const current = normalizeEmail(email);
  if (Boolean(configured) && Boolean(current) && configured === current) {
    return true;
  }

  const approverId = normalizeId(process.env.APPROVER_ADMIN_ID);
  const localPart = current.split("@")[0] ?? "";
  return Boolean(approverId) && Boolean(localPart) && approverId === localPart;
}

