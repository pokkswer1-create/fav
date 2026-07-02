"use client";

import { authFetch } from "@/lib/auth-fetch";
import {
  computeDeductionBreakdown,
  FOUR_INSURANCE_OPTIONS,
  type EmployeePayrollInput,
} from "@/lib/payroll/deductions";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type EmployeeSalaryRow = {
  id: string;
  name: string;
  salaryType: "monthly" | "hourly" | "freelance";
  salary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  monthlyWorkHours?: number;
  taxRate?: number;
  deductionPension: number;
  deductionHealth: number;
  deductionLongTermCare: number;
  deductionEmployment: number;
  deductionOther: number;
  paidStatus: "pending" | "paid";
};

const defaultInsurances = FOUR_INSURANCE_OPTIONS.map((o) => o.key);

export default function PayrollPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<EmployeeSalaryRow[]>([]);
  const [form, setForm] = useState({
    name: "",
    position: "",
    employmentType: "full_time",
    phone: "",
    account: "",
    salaryType: "monthly",
    monthlyFee: 2500000,
    hourlyRate: 15000,
    freelanceFee: 50000,
    monthlyWorkHours: 40,
    taxRate: 3.3,
    pensionRate: 4.5,
    healthInsuranceRate: 3.55,
    longTermCareRate: 0.91,
    employmentInsuranceRate: 0.9,
    workDays: ["mon", "wed", "fri"],
    insurances: defaultInsurances,
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const formAsPayrollInput = useMemo((): EmployeePayrollInput => {
    return {
      salary_type: form.salaryType,
      monthly_fee: form.monthlyFee,
      hourly_rate: form.hourlyRate,
      freelance_fee: form.freelanceFee,
      monthly_work_hours: form.monthlyWorkHours,
      tax_rate: form.taxRate,
      insurances: form.insurances,
      pension_rate: form.pensionRate,
      health_insurance_rate: form.healthInsuranceRate,
      long_term_care_rate: form.longTermCareRate,
      employment_insurance_rate: form.employmentInsuranceRate,
    };
  }, [form]);

  const previewBreakdown = useMemo(
    () => computeDeductionBreakdown(formAsPayrollInput, 0),
    [formAsPayrollInput]
  );

  const grossPreview = useMemo(() => {
    if (form.salaryType === "monthly") return Number(form.monthlyFee);
    if (form.salaryType === "hourly") return Number(form.hourlyRate) * Number(form.monthlyWorkHours);
    return Number(form.freelanceFee) * 20;
  }, [form]);

  const totals = useMemo(() => {
    const gross = rows.reduce((sum, row) => sum + row.salary + row.bonus, 0);
    const deduction = rows.reduce((sum, row) => sum + row.deductions, 0);
    const net = rows.reduce((sum, row) => sum + row.netSalary, 0);
    const four = rows.reduce(
      (sum, row) =>
        sum +
        row.deductionPension +
        row.deductionHealth +
        row.deductionLongTermCare +
        row.deductionEmployment,
      0
    );
    return { gross, deduction, net, four };
  }, [rows]);

  const loadRows = async () => {
    const res = await authFetch(`/api/employees?month=${month}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load payroll.");
      return;
    }
    const raw = json.data ?? [];
    setRows(
      raw.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: r.name as string,
        salaryType: r.salaryType as EmployeeSalaryRow["salaryType"],
        salary: Number(r.salary ?? 0),
        bonus: Number(r.bonus ?? 0),
        deductions: Number(r.deductions ?? 0),
        netSalary: Number(r.netSalary ?? 0),
        monthlyWorkHours: r.monthlyWorkHours as number | undefined,
        taxRate: r.taxRate as number | undefined,
        deductionPension: Number(r.deductionPension ?? 0),
        deductionHealth: Number(r.deductionHealth ?? 0),
        deductionLongTermCare: Number(r.deductionLongTermCare ?? 0),
        deductionEmployment: Number(r.deductionEmployment ?? 0),
        deductionOther: Number(r.deductionOther ?? 0),
        paidStatus: (r.paidStatus as EmployeeSalaryRow["paidStatus"]) ?? "pending",
      }))
    );
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const calculate = async () => {
    const res = await authFetch(`/api/salary/calculate?month=${month}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "급여 계산 실패");
      return;
    }
    setMessage("급여 계산이 완료되었습니다.");
    void loadRows();
  };

  const pay = async (row: EmployeeSalaryRow) => {
    const res = await authFetch("/api/salary/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: row.id,
        month,
        amount: row.netSalary,
        method: "manual",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "급여 지급 실패");
      return;
    }
    setRows((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, paidStatus: "paid" } : item))
    );
  };

  const createEmployee = async () => {
    const res = await authFetch("/api/employees/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "직원 추가 실패");
      return;
    }
    setMessage("직원이 추가되었습니다.");
    setForm((prev) => ({
      ...prev,
      name: "",
      position: "",
      phone: "",
      account: "",
      insurances: defaultInsurances,
    }));
    void loadRows();
  };

  const toggleInsurance = (key: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      insurances: checked
        ? [...prev.insurances, key]
        : prev.insurances.filter((k) => k !== key),
    }));
  };

  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">급여 관리</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        4대보험(국민연금·건강·장기요양·고용)은 세전 급여에 대해 체크한 항목만 요율(%)을 곱해 공제합니다. 실제
        급여대장과 다를 수 있으니 보수월액·당해 요율표에 맞게 숫자를 조정하세요. &quot;기타 공제&quot;는 소득세·지방소득세
        등 추가 비율입니다.
      </p>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-4">
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="직원명"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="직급"
          value={form.position}
          onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
        />
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={form.salaryType}
          onChange={(e) => setForm((prev) => ({ ...prev, salaryType: e.target.value }))}
        >
          <option value="monthly">월급</option>
          <option value="hourly">시급</option>
          <option value="freelance">프리랜서</option>
        </select>
        {form.salaryType === "monthly" ? (
          <input
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="number"
            placeholder="세전 월급"
            value={form.monthlyFee}
            onChange={(e) => setForm((prev) => ({ ...prev, monthlyFee: Number(e.target.value) }))}
          />
        ) : null}
        {form.salaryType === "hourly" ? (
          <>
            <input
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              type="number"
              placeholder="세전 시급"
              value={form.hourlyRate}
              onChange={(e) => setForm((prev) => ({ ...prev, hourlyRate: Number(e.target.value) }))}
            />
            <input
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              type="number"
              placeholder="월 근무시간"
              value={form.monthlyWorkHours}
              onChange={(e) => setForm((prev) => ({ ...prev, monthlyWorkHours: Number(e.target.value) }))}
            />
          </>
        ) : null}
        {form.salaryType === "freelance" ? (
          <input
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="number"
            placeholder="세전 일당(×20으로 월 환산)"
            value={form.freelanceFee}
            onChange={(e) => setForm((prev) => ({ ...prev, freelanceFee: Number(e.target.value) }))}
          />
        ) : null}

        <div className="md:col-span-4">
          <p className="mb-2 text-sm font-medium">4대보험 가입(공제 적용)</p>
          <div className="flex flex-wrap gap-4">
            {FOUR_INSURANCE_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.insurances.includes(opt.key)}
                  onChange={(e) => toggleInsurance(opt.key, e.target.checked)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 md:col-span-4 lg:grid-cols-4">
          {FOUR_INSURANCE_OPTIONS.map((opt) => (
            <label key={opt.rateField} className="flex flex-col gap-1 text-xs">
              <span>{opt.label} 요율(%)</span>
              <input
                type="number"
                step="0.01"
                className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
                value={form[opt.rateField]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [opt.rateField]: Number(e.target.value) }))
                }
              />
            </label>
          ))}
        </div>

        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="number"
          step="0.1"
          placeholder="기타 공제율(%) 소득세 등"
          value={form.taxRate}
          onChange={(e) => setForm((prev) => ({ ...prev, taxRate: Number(e.target.value) }))}
        />
        <button
          type="button"
          onClick={createEmployee}
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          직원 추가
        </button>
        <div className="rounded border p-3 text-sm dark:border-zinc-700 md:col-span-4">
          <p>세전: {won(grossPreview)}</p>
          <p>
            국민연금 {won(previewBreakdown.pension)} · 건강 {won(previewBreakdown.health)} · 장기요양{" "}
            {won(previewBreakdown.longTermCare)} · 고용 {won(previewBreakdown.employment)}
          </p>
          <p>
            기타({form.taxRate}%): {won(previewBreakdown.other)}
          </p>
          <p>총 공제: {won(previewBreakdown.total)}</p>
          <p className="font-semibold">예상 실수령: {won(grossPreview - previewBreakdown.total)}</p>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-6">
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
          onClick={calculate}
        >
          일괄 급여 계산
        </button>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">총 지급전</p>
          <p className="text-lg font-semibold">{won(totals.gross)}</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">4대보험 합</p>
          <p className="text-lg font-semibold">{won(totals.four)}</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">총 공제</p>
          <p className="text-lg font-semibold">{won(totals.deduction)}</p>
        </div>
        <div className="rounded border p-3 dark:border-zinc-700">
          <p className="text-sm opacity-70">총 순급여</p>
          <p className="text-lg font-semibold">{won(totals.net)}</p>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>강사</Th>
              <Th>월</Th>
              <Th>기본급</Th>
              <Th>보너스</Th>
              <Th>국민연금</Th>
              <Th>건강</Th>
              <Th>장기요양</Th>
              <Th>고용</Th>
              <Th>기타</Th>
              <Th>총공제</Th>
              <Th>순급여</Th>
              <Th>상태</Th>
              <Th>액션</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <Td>{row.name}</Td>
                <Td>{month}</Td>
                <Td>{won(row.salary)}</Td>
                <Td>{won(row.bonus)}</Td>
                <Td>{won(row.deductionPension)}</Td>
                <Td>{won(row.deductionHealth)}</Td>
                <Td>{won(row.deductionLongTermCare)}</Td>
                <Td>{won(row.deductionEmployment)}</Td>
                <Td>{won(row.deductionOther)}</Td>
                <Td>{won(row.deductions)}</Td>
                <Td>{won(row.netSalary)}</Td>
                <Td>{row.paidStatus === "paid" ? "지급완료" : "계산완료"}</Td>
                <Td>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
                    disabled={row.paidStatus === "paid"}
                    onClick={() => pay(row)}
                  >
                    급여 지급
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
