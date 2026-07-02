export type MonthRef = "this" | "last" | string;

export type AssistantTopic =
  | "revenue"
  | "absence_month"
  | "absence_today"
  | "unpaid"
  | "unpaid_list"
  | "pending_reservations"
  | "action_notify_unpaid"
  | "action_refresh_kva"
  | "members"
  | "attendance_rate"
  | "profit"
  | "summary"
  | "unknown";

export type ClassifiedQuery = {
  topic: AssistantTopic;
  monthRef: MonthRef;
};

function pickMonthFromText(text: string): MonthRef | null {
  if (/지난\s*달|전월|저번\s*달/.test(text)) return "last";
  if (/이번\s*달|당월|금월/.test(text)) return "this";
  const monthMatch = text.match(/(\d{1,2})\s*월/);
  if (monthMatch) {
    const monthNum = Number(monthMatch[1]);
    if (monthNum >= 1 && monthNum <= 12) {
      const y = new Date()
        .toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
        .slice(0, 4);
      return `${y}-${String(monthNum).padStart(2, "0")}`;
    }
  }
  return null;
}

export function classifyAssistantQuery(raw: string): ClassifiedQuery {
  const text = raw.trim().toLowerCase();
  const monthRef = pickMonthFromText(text) ?? "this";

  if (/오늘.*결석|결석.*오늘|오늘.*누구|누가\s*결석/.test(text)) {
    return { topic: "absence_today", monthRef: "this" };
  }

  if (
    (/(보내줘|보내|발송|재발송|독촉|전송|안내해|알림\s*줘|다시\s*보내|일괄)/.test(text) &&
      /(미납|미수|결제|수강료|링크|청구|입금\s*안|부모|학부모)/.test(text)) ||
    /(send|notify|remind).*(unpaid|payment|fee)/.test(text)
  ) {
    return { topic: "action_notify_unpaid", monthRef };
  }

  if (
    /(kva|연맹|공인\s*인증|외식업)/.test(text) &&
    /(가져와|가져와줘|갱신|동기화|새로고침|크롤|불러와|업데이트)/.test(text)
  ) {
    return { topic: "action_refresh_kva", monthRef: "this" };
  }
  if (/공지.*(다시\s*가져|갱신|동기화|새로고침|불러와)/.test(text)) {
    return { topic: "action_refresh_kva", monthRef: "this" };
  }

  if (
    /(예약\s*대기|대기\s*예약)/.test(text) ||
    /(네이버|플레이스).*(예약|대기).*(몇|현황|알려)/.test(text) ||
    /(카카오|채널).*(예약|대기).*(몇|현황|알려)/.test(text)
  ) {
    return { topic: "pending_reservations", monthRef };
  }

  if (/(매출|수입|결제\s*액|들어온\s*돈|수강료\s*입금)/.test(text)) {
    return { topic: "revenue", monthRef };
  }

  if (/(미납|미수).*(이름|누구|목록|리스트|명단)/.test(text) || /(누가\s*미납|미납\s*학생)/.test(text)) {
    return { topic: "unpaid_list", monthRef };
  }

  if (/(미납|미수|받을\s*돈|청구\s*잔액)/.test(text)) {
    return { topic: "unpaid", monthRef };
  }

  if (/(결석|결석자|결석\s*인원|결석\s*몇)/.test(text)) {
    if (/오늘|금일/.test(text)) return { topic: "absence_today", monthRef: "this" };
    return { topic: "absence_month", monthRef };
  }

  if (/(회원|학생).*?(수|명|몇)|재원|등록\s*인원/.test(text)) {
    return { topic: "members", monthRef };
  }

  if (/(출석률|출석\s*율)/.test(text)) {
    return { topic: "attendance_rate", monthRef };
  }

  if (/(순이익|이익|영업이익|남은\s*돈)/.test(text)) {
    return { topic: "profit", monthRef };
  }

  if (/(요약|한\s*번에|전체|현황|알려줘|어때)/.test(text)) {
    return { topic: "summary", monthRef };
  }

  return { topic: "unknown", monthRef };
}

function monthKeyFromRef(ref: MonthRef): string {
  if (ref === "this") {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 7);
  }
  if (ref === "last") {
    const d = new Date();
    const k = d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const base = new Date(`${k}T12:00:00`);
    base.setMonth(base.getMonth() - 1);
    return base.toISOString().slice(0, 7);
  }
  if (/^\d{4}-\d{2}$/.test(ref)) return ref;
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 7);
}

export { monthKeyFromRef };

export async function refineIntentWithOpenAI(message: string): Promise<ClassifiedQuery | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ASSISTANT_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `학원 관리자의 한국어 입력을 분류합니다. 반드시 JSON만 출력합니다.
필드 topic:
- 조회: revenue | absence_month | absence_today | unpaid | unpaid_list | pending_reservations | members | attendance_rate | profit | summary | unknown
- 실행(관리자 전용으로 서버에서 다시 확인): action_notify_unpaid (미납/대기 학부모에게 결제 안내 발송) | action_refresh_kva (KVA 공지 다시 수집)
필드 monthRef: "this" | "last" | "YYYY-MM"
실행/월 질문이 아니면 monthRef는 "this".
"N월"만 있으면 참고 날짜의 연도를 사용.`,
          },
          {
            role: "user",
            content: `${message}\n\n[참고: 오늘(Asia/Seoul) ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })}]`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { topic?: string; monthRef?: string };
    const topic = parsed.topic as AssistantTopic | undefined;
    const allowed: AssistantTopic[] = [
      "revenue",
      "absence_month",
      "absence_today",
      "unpaid",
      "unpaid_list",
      "pending_reservations",
      "action_notify_unpaid",
      "action_refresh_kva",
      "members",
      "attendance_rate",
      "profit",
      "summary",
      "unknown",
    ];
    if (!topic || !allowed.includes(topic)) return null;
    const mr = parsed.monthRef;
    const monthRef: MonthRef =
      mr === "this" || mr === "last" || (typeof mr === "string" && /^\d{4}-\d{2}$/.test(mr))
        ? (mr as MonthRef)
        : "this";
    return { topic, monthRef };
  } catch {
    return null;
  }
}
