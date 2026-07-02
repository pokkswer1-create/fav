/** 4대보험 가입 항목 키 (employees.insurances) */
export const FOUR_INSURANCE_KEYS = {
  nationalPension: "national_pension",
  healthInsurance: "health_insurance",
  longTermCare: "long_term_care",
  employmentInsurance: "employment_insurance",
} as const;

/** UI용 — 요율은 세전 급여 대비 근로자 부담을 단순 합산한 값(실제는 보수월액·요율표 기준) */
export const FOUR_INSURANCE_OPTIONS: {
  key: string;
  label: string;
  rateField: "pensionRate" | "healthInsuranceRate" | "longTermCareRate" | "employmentInsuranceRate";
  defaultRate: number;
}[] = [
  { key: FOUR_INSURANCE_KEYS.nationalPension, label: "국민연금", rateField: "pensionRate", defaultRate: 4.5 },
  {
    key: FOUR_INSURANCE_KEYS.healthInsurance,
    label: "건강보험",
    rateField: "healthInsuranceRate",
    defaultRate: 3.55,
  },
  {
    key: FOUR_INSURANCE_KEYS.longTermCare,
    label: "장기요양보험",
    rateField: "longTermCareRate",
    defaultRate: 0.91,
  },
  {
    key: FOUR_INSURANCE_KEYS.employmentInsurance,
    label: "고용보험",
    rateField: "employmentInsuranceRate",
    defaultRate: 0.9,
  },
];

export type EmployeePayrollInput = {
  salary_type: string;
  monthly_fee: number | null;
  hourly_rate: number | null;
  freelance_fee: number | null;
  monthly_work_hours: number | null;
  tax_rate: number | null;
  insurances: string[] | null;
  pension_rate?: number | null;
  health_insurance_rate?: number | null;
  long_term_care_rate?: number | null;
  employment_insurance_rate?: number | null;
};

export function grossSalaryBeforeBonus(employee: EmployeePayrollInput): number {
  const hours = Number(employee.monthly_work_hours ?? 40);
  if (employee.salary_type === "monthly") {
    return Number(employee.monthly_fee ?? 0);
  }
  if (employee.salary_type === "hourly") {
    return Number(employee.hourly_rate ?? 0) * hours;
  }
  return Number(employee.freelance_fee ?? 0) * 20;
}

export type DeductionBreakdown = {
  pension: number;
  health: number;
  longTermCare: number;
  employment: number;
  other: number;
  total: number;
};

export function computeDeductionBreakdown(
  employee: EmployeePayrollInput,
  bonus: number
): DeductionBreakdown {
  const base = grossSalaryBeforeBonus(employee);
  const gross = base + bonus;
  const ins = employee.insurances ?? [];

  const pr = Number(employee.pension_rate ?? 4.5);
  const hr = Number(employee.health_insurance_rate ?? 3.55);
  const lt = Number(employee.long_term_care_rate ?? 0.91);
  const er = Number(employee.employment_insurance_rate ?? 0.9);
  const tax = Number(employee.tax_rate ?? 0);

  const pension = ins.includes(FOUR_INSURANCE_KEYS.nationalPension)
    ? Math.round((gross * pr) / 100)
    : 0;
  const health = ins.includes(FOUR_INSURANCE_KEYS.healthInsurance)
    ? Math.round((gross * hr) / 100)
    : 0;
  const longTermCare = ins.includes(FOUR_INSURANCE_KEYS.longTermCare)
    ? Math.round((gross * lt) / 100)
    : 0;
  const employment = ins.includes(FOUR_INSURANCE_KEYS.employmentInsurance)
    ? Math.round((gross * er) / 100)
    : 0;
  const other = Math.round((gross * tax) / 100);

  return {
    pension,
    health,
    longTermCare,
    employment,
    other,
    total: pension + health + longTermCare + employment + other,
  };
}
