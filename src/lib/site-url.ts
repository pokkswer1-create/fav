/**
 * 외부(다른 기기)에서 접속할 공개 사이트 루트 https://...
 * 1) NEXT_PUBLIC_SITE_URL — 직접 지정(권장)
 * 2) VERCEL_PROJECT_PRODUCTION_URL — Vercel 프로덕션 호스트(안정 주소)
 * 3) VERCEL_URL — 이번 배포 전용 호스트
 */
export function getDeployedSiteBase(): string | null {
  const custom = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (custom) return custom;

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    const host = productionHost.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return null;
}

export function getParentsPublicUrl(): string | null {
  const b = getDeployedSiteBase();
  return b ? `${b}/parents` : null;
}
