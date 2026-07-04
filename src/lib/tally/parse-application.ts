export type TallyField = {
  key?: string;
  label?: string;
  type?: string;
  value?: unknown;
  options?: Array<{ id?: string; text?: string }>;
};

export type TallyWebhookPayload = {
  eventType?: string;
  data?: {
    formId?: string;
    formName?: string;
    responseId?: string;
    fields?: TallyField[];
  };
};

export type ParsedTallyApplication = {
  formMode: "trial" | "regular";
  studentName: string;
  phone: string;
  parentPhone: string;
  parentName: string | null;
  school: string | null;
  address: string | null;
  ageGroup: string | null;
  gradeInfo: string | null;
  programType: string;
  selectedClasses: string[];
  trialClass: string | null;
  trialDate: string | null;
  depositConfirmed: boolean;
  applicationPath: string | null;
  paymentMethod: string | null;
  agreePrivacy: boolean;
  agreeRefund: boolean;
  agreeMakeup: boolean;
  source: string;
  formId: string | null;
  responseId: string | null;
};

function normalizeLabel(label: string) {
  return label
    .replace(/<[^>]+>/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function optionText(field: TallyField, id: string) {
  return field.options?.find((o) => o.id === id)?.text?.trim() ?? id;
}

function fieldValueToStrings(field: TallyField): string[] {
  const { value, type } = field;
  if (value == null) return [];

  if (type === "CHECKBOXES") {
    if (typeof value === "boolean") {
      if (!value) return [];
      const label = String(field.label ?? "");
      const paren = label.match(/\(([^)]+)\)\s*$/);
      return paren ? [paren[1].trim()] : [label.trim()];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        if (typeof item === "string") return [optionText(field, item)];
        if (typeof item === "boolean") return item ? [String(field.label ?? "checked")] : [];
        return [String(item)];
      });
    }
  }

  if (Array.isArray(value)) {
    if (type === "MULTIPLE_CHOICE" || type === "DROPDOWN" || type === "MULTI_SELECT") {
      return value.map((item) =>
        typeof item === "string" ? optionText(field, item) : String(item)
      );
    }
    return value.map((item) => String(item));
  }

  if (typeof value === "boolean") return value ? ["true"] : [];
  return [String(value).trim()].filter(Boolean);
}

function firstString(values: string[]) {
  return values.find((v) => v.trim().length > 0)?.trim() ?? null;
}

function includesAny(text: string, needles: string[]) {
  const n = normalizeLabel(text);
  return needles.some((needle) => n.includes(normalizeLabel(needle)));
}

function isTruthyAgreement(values: string[]) {
  return values.some((v) => /동의|agree|yes|true|입금/i.test(v));
}

function detectFormMode(allValues: Array<{ label: string; values: string[] }>) {
  for (const item of allValues) {
    if (!includesAny(item.label, ["수업 형태", "formmode", "lesson type"])) continue;
    const joined = item.values.join(" ");
    if (includesAny(joined, ["체험", "trial"])) return "trial" as const;
    if (includesAny(joined, ["정규", "regular"])) return "regular" as const;
  }

  for (const item of allValues) {
    if (includesAny(item.label, ["체험 클래스", "trial class", "체험 날짜", "trial date"])) {
      return "trial" as const;
    }
  }

  for (const item of allValues) {
    if (includesAny(item.label, ["정규 클래스", "regular class", "신청 경로"])) {
      return "regular" as const;
    }
  }

  return "regular" as const;
}

export function parseTallyApplication(payload: TallyWebhookPayload): ParsedTallyApplication {
  const fields = payload.data?.fields ?? [];
  const mapped = fields.map((field) => ({
    label: String(field.label ?? field.key ?? ""),
    values: fieldValueToStrings(field),
  }));

  const read = (labelNeedles: string[]) => {
    for (const item of mapped) {
      if (includesAny(item.label, labelNeedles)) {
        const v = firstString(item.values);
        if (v) return v;
      }
    }
    return null;
  };

  const readAll = (labelNeedles: string[]) => {
    const out: string[] = [];
    for (const item of mapped) {
      if (includesAny(item.label, labelNeedles)) out.push(...item.values);
    }
    return [...new Set(out.map((v) => v.trim()).filter(Boolean))];
  };

  const readBool = (labelNeedles: string[]) => {
    for (const item of mapped) {
      if (!includesAny(item.label, labelNeedles)) continue;
      if (isTruthyAgreement(item.values)) return true;
    }
    return false;
  };

  const studentName = read(["수강생 이름", "student name", "name"]) ?? "";
  const phone = read(["수강생 전화", "student phone", "phone"]) ?? "";
  const parentPhone =
    read(["부모님 전화", "보호자 전화", "guardian phone", "parent phone"]) ?? "";
  const parentName = read(["부모님 성함", "보호자 성함", "parent name"]);
  const school = read(["학교", "school"]);
  const address = read(["주소", "address"]);
  const ageGroup = read(["대상자 연령", "age group"]);
  const gradeInfo = read(["학년", "나이", "생년월일", "grade"]);
  const formMode = detectFormMode(mapped);

  const trialClass =
    read(["체험 클래스", "trial class"]) ??
    (formMode === "trial" ? read(["클래스 선택"]) : null);
  const trialDate = read(["체험 날짜", "trial date"]);
  const applicationPath = read(["신청 경로", "application path"]);
  const paymentMethod = read(["결제방법", "결제 방법", "payment"]);
  const selectedClasses =
    formMode === "regular"
      ? readAll(["정규 클래스", "regular class", "클래스 선택", "원하시는 횟수"])
      : readAll(["정규 클래스", "regular class"]);

  const agreePrivacy = readBool(["개인정보", "privacy", "agreeprivacy"]);
  const agreeRefund = readBool(["환불 규정", "refund"]);
  const agreeMakeup = readBool(["보강 규정", "makeup"]);
  const depositConfirmed = readBool(["입금", "deposit"]);

  const programType =
    formMode === "trial"
      ? trialClass ?? ageGroup ?? "체험수업"
      : selectedClasses[0] ?? ageGroup ?? "정규수업";

  return {
    formMode,
    studentName,
    phone,
    parentPhone,
    parentName,
    school: school ?? gradeInfo,
    address,
    ageGroup,
    gradeInfo,
    programType,
    selectedClasses,
    trialClass,
    trialDate,
    depositConfirmed,
    applicationPath,
    paymentMethod,
    agreePrivacy,
    agreeRefund,
    agreeMakeup,
    source: "tally",
    formId: payload.data?.formId ?? null,
    responseId: payload.data?.responseId ?? null,
  };
}

export function buildApplicationNotes(parsed: ParsedTallyApplication) {
  const lines = [
    `[source] tally`,
    `[formMode] ${parsed.formMode}`,
    `[program] ${parsed.programType}`,
    parsed.ageGroup ? `[ageGroup] ${parsed.ageGroup}` : null,
    parsed.gradeInfo ? `[gradeInfo] ${parsed.gradeInfo}` : null,
    parsed.trialClass ? `[trialClass] ${parsed.trialClass}` : null,
    parsed.trialDate ? `[trialDate] ${parsed.trialDate}` : null,
    parsed.depositConfirmed ? `[depositConfirmed] true` : `[depositConfirmed] false`,
    parsed.applicationPath ? `[applicationPath] ${parsed.applicationPath}` : null,
    parsed.paymentMethod ? `[paymentMethod] ${parsed.paymentMethod}` : null,
    parsed.formId ? `[tallyFormId] ${parsed.formId}` : null,
    parsed.responseId ? `[tallyResponseId] ${parsed.responseId}` : null,
    `[agreePrivacy] ${parsed.agreePrivacy}`,
    `[agreeRefund] ${parsed.agreeRefund}`,
    `[agreeMakeup] ${parsed.agreeMakeup}`,
  ].filter(Boolean);

  if (parsed.selectedClasses.length > 0) {
    lines.push(`[selectedClasses] ${parsed.selectedClasses.join(" | ")}`);
  }

  return lines.join("\n");
}
