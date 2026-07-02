/**
 * 반(수업) 월 수강료·월 수업 횟수는 여기서만 정의합니다. 금액 변경 시 이 파일만 수정하면 됩니다.
 */
export const FEE_TIER_IDS = ["weekly_1", "weekly_2", "weekly_3", "elite_team", "tryout"] as const;
export type ClassFeeTierId = (typeof FEE_TIER_IDS)[number];

export type ClassFeeTier = {
  label: string;
  monthly_fee: number;
  monthly_sessions: number;
  class_category: "general" | "elite" | "tryout";
};

export const CLASS_FEE_TIERS: Record<ClassFeeTierId, ClassFeeTier> = {
  weekly_1: { label: "주1회", monthly_fee: 120_000, monthly_sessions: 4, class_category: "general" },
  weekly_2: { label: "주2회", monthly_fee: 200_000, monthly_sessions: 8, class_category: "general" },
  weekly_3: { label: "주3회", monthly_fee: 270_000, monthly_sessions: 12, class_category: "general" },
  elite_team: { label: "대표팀", monthly_fee: 320_000, monthly_sessions: 12, class_category: "elite" },
  tryout: { label: "트라이아웃", monthly_fee: 80_000, monthly_sessions: 4, class_category: "tryout" },
};

export function isClassFeeTierId(v: string): v is ClassFeeTierId {
  return (FEE_TIER_IDS as readonly string[]).includes(v);
}

export function getFeesForTier(tierId: ClassFeeTierId): ClassFeeTier {
  return CLASS_FEE_TIERS[tierId];
}

/** DB에 저장된 값과 일치하는 구간이 있으면 반환, 없으면 null (맞춤 요금) */
export function matchTierForClass(klass: {
  monthly_fee: number;
  monthly_sessions: number;
  class_category: string;
}): ClassFeeTierId | null {
  for (const id of FEE_TIER_IDS) {
    const t = CLASS_FEE_TIERS[id];
    if (
      t.monthly_fee === Number(klass.monthly_fee) &&
      t.monthly_sessions === Number(klass.monthly_sessions) &&
      t.class_category === klass.class_category
    ) {
      return id;
    }
  }
  return null;
}

export function tierSummaryLabel(klass: {
  monthly_fee: number;
  monthly_sessions: number;
  class_category: string;
}): string {
  const id = matchTierForClass(klass);
  if (id) {
    const t = CLASS_FEE_TIERS[id];
    return `${t.label} · ${t.monthly_fee.toLocaleString("ko-KR")}원 · 월 ${t.monthly_sessions}회`;
  }
  return `맞춤 · ${Number(klass.monthly_fee).toLocaleString("ko-KR")}원 · 월 ${klass.monthly_sessions}회`;
}
