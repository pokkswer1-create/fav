import { mockEmailProvider } from "@/lib/providers/email/mock";

function buildSubject(kind: "submitted" | "approved" | "rejected") {
  if (kind === "submitted") return "[원패스클래스] 회원가입 신청이 접수되었습니다";
  if (kind === "approved") return "[원패스클래스] 회원가입이 승인되었습니다";
  return "[원패스클래스] 회원가입 검토 결과 안내";
}

function buildHtml(input: {
  kind: "submitted" | "approved" | "rejected";
  fullName: string;
  rejectionReason?: string | null;
}) {
  const loginUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth`
    : "https://www.onepassclass.co.kr/auth";

  if (input.kind === "submitted") {
    return `
      <p>${input.fullName}님, 회원가입 신청이 접수되었습니다.</p>
      <p>관리자 승인 후 서비스 이용이 가능합니다.</p>
      <p>승인 완료 시 다시 안내해드리겠습니다.</p>
    `;
  }

  if (input.kind === "approved") {
    return `
      <p>${input.fullName}님, 회원가입이 승인되었습니다.</p>
      <p>아래 링크에서 로그인 후 서비스를 이용해 주세요.</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
    `;
  }

  return `
    <p>${input.fullName}님, 회원가입 신청이 반려되었습니다.</p>
    ${
      input.rejectionReason
        ? `<p>반려 사유: ${input.rejectionReason}</p>`
        : "<p>자세한 내용은 관리자에게 문의해 주세요.</p>"
    }
  `;
}

export async function sendApprovalEmail(params: {
  to: string | null | undefined;
  fullName: string | null | undefined;
  kind: "submitted" | "approved" | "rejected";
  rejectionReason?: string | null;
}) {
  const to = (params.to ?? "").trim();
  if (!to) return { ok: false, skipped: true as const };

  const fullName = (params.fullName ?? "").trim() || "회원";
  const subject = buildSubject(params.kind);
  const html = buildHtml({
    kind: params.kind,
    fullName,
    rejectionReason: params.rejectionReason,
  });
  const result = await mockEmailProvider.send({ to, subject, html });
  return { ok: result.ok, skipped: false as const, providerMessageId: result.providerMessageId };
}

