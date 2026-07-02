/** 학부모 사이트 상호·문구 (관리: 학부모 사이트 설정 → 사이트명) */
export type SiteBranding = {
  /** 로고 옆 짧은 이름 */
  name: string;
  /** 메인 배너 큰 제목 */
  title: string;
  /** 배너 부제 */
  tagline: string;
  /** 로고 이모지(없으면 빈 문자열) */
  emoji: string;
  /** 체험 모달 안내. {name} 은 짧은 이름으로 치환 */
  trial_intro: string;
  /** 푸터 주소 한 줄 */
  footer_address: string;
  /** 푸터 전화 한 줄 */
  footer_phone: string;
};

export const defaultSiteBranding: SiteBranding = {
  name: "JB 스포츠",
  title: "JB 스포츠 배구학원",
  tagline: "전문 코치와 함께 배구의 즐거움을 배워보세요!",
  emoji: "🏐",
  trial_intro: "체험수업을 통해 {name}의 수업을 경험해 보세요.",
  footer_address: "경기도 용인시 수지구 신봉2로 94-6",
  footer_phone: "전화: 031-1234-5678",
};

export function mergeSiteBranding(raw: unknown): SiteBranding {
  if (!raw || typeof raw !== "object") {
    return { ...defaultSiteBranding };
  }
  const o = raw as Partial<SiteBranding>;
  return {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : defaultSiteBranding.name,
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : defaultSiteBranding.title,
    tagline:
      typeof o.tagline === "string" && o.tagline.trim() ? o.tagline.trim() : defaultSiteBranding.tagline,
    emoji: typeof o.emoji === "string" ? o.emoji : defaultSiteBranding.emoji,
    trial_intro:
      typeof o.trial_intro === "string" && o.trial_intro.trim()
        ? o.trial_intro.trim()
        : defaultSiteBranding.trial_intro,
    footer_address:
      typeof o.footer_address === "string" && o.footer_address.trim()
        ? o.footer_address.trim()
        : defaultSiteBranding.footer_address,
    footer_phone:
      typeof o.footer_phone === "string" && o.footer_phone.trim()
        ? o.footer_phone.trim()
        : defaultSiteBranding.footer_phone,
  };
}

/** 학부모 사이트 기본값 (DB에 행이 없을 때 API/UI 폴백) */
export const defaultAcademySettings = {
  site_branding: { ...defaultSiteBranding },
  tuition: {
    "60min": {
      "1week": 180000,
      "2week": 320000,
      fee: 50000,
      kit: "웰컴키트 별도 안내",
    },
    "90min": {
      "1week": 220000,
      "2week": 380000,
      fee: 50000,
      kit: "웰컴키트 별도 안내",
    },
    elite: { monthly: 280000, fee: 50000, kit: "유니폼·양말 등" },
    adult: { evening: 120000, morning: 150000 },
  },
  preparation_items: [
    "실내전용 운동화 필수",
    "음식물 반입 제한",
    "개인 물통 지참",
  ],
  shuttle_info: {
    youth: "유소년 셔틀 노선은 상담 시 안내",
    adult: "성인반 별도 문의",
    schedule: "시간표는 카카오 오픈채팅에서 확인",
  },
  payment_guide: {
    info1: "전월 15일~익월 5일 선결제",
    info2: "월 단위 결제",
    info3: "카카오톡 결제 링크 발송",
    info4: "현장 결제 가능 여부는 사무실 문의",
  },
  makeup_policy: {
    min60: "월 2회",
    min90: "월 2회",
    elite: "대표팀 별도 규정",
    adult: "성인반 제한적",
  },
  refund_policy: {
    bullets: [
      "서비스 개시 전: 납부 수강료 전액 환불",
      "첫 수업 전: 총액의 10% 위약금 공제 후 환불",
      "1회 수업 후: 위약금 10% + 1회분 공제",
      "2회 수업 후: 위약금 10% + 2회분 공제",
      "3회 이상: 학원법 및 내부 규정에 따라 환불 불가",
    ],
  },
} as const;

export type TuitionSettings = typeof defaultAcademySettings.tuition;
