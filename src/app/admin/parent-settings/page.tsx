"use client";

import { authFetch } from "@/lib/auth-fetch";
import { defaultAcademySettings, defaultSiteBranding, mergeSiteBranding } from "@/lib/parent-site/defaults";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Tab = "branding" | "preparation" | "shuttle" | "payment" | "makeup" | "refund" | "tuition" | "notices";

type TuitionForm = {
  min60_1week: number;
  min60_2week: number;
  min60_fee: number;
  min60_kit: string;
  min90_1week: number;
  min90_2week: number;
  min90_fee: number;
  min90_kit: string;
  elite_monthly: number;
  elite_fee: number;
  elite_kit: string;
  adult_evening: number;
  adult_morning: number;
};

type CustomClassPrice = {
  class_name: string;
  week1_price: number;
  week2_price: number;
  week3_price: number;
  elite_price: number;
  tryout_price: number;
  shuttle_fee: number;
  discount_percent: number;
  discount_won: number;
};

function toWonText(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;
}

function applyDiscount(base: number, discountPercent: number, discountWon: number) {
  const safeBase = Number.isFinite(base) ? base : 0;
  const pct = Math.min(100, Math.max(0, Number.isFinite(discountPercent) ? discountPercent : 0));
  const won = Math.max(0, Number.isFinite(discountWon) ? discountWon : 0);
  const discounted = safeBase - (safeBase * pct) / 100 - won;
  return Math.max(0, Math.round(discounted));
}

export default function ParentSettingsPage() {
  const [tab, setTab] = useState<Tab>("branding");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preparationText, setPreparationText] = useState(
    defaultAcademySettings.preparation_items.join("\n")
  );
  const [shuttleJson, setShuttleJson] = useState(
    JSON.stringify(defaultAcademySettings.shuttle_info, null, 2)
  );
  const [paymentJson, setPaymentJson] = useState(
    JSON.stringify(defaultAcademySettings.payment_guide, null, 2)
  );
  const [makeupJson, setMakeupJson] = useState(
    JSON.stringify(defaultAcademySettings.makeup_policy, null, 2)
  );
  const [refundJson, setRefundJson] = useState(
    JSON.stringify(defaultAcademySettings.refund_policy, null, 2)
  );
  const [tuitionForm, setTuitionForm] = useState<TuitionForm>({
    min60_1week: Number(defaultAcademySettings.tuition["60min"]["1week"] ?? 0),
    min60_2week: Number(defaultAcademySettings.tuition["60min"]["2week"] ?? 0),
    min60_fee: Number(defaultAcademySettings.tuition["60min"].fee ?? 0),
    min60_kit: String(defaultAcademySettings.tuition["60min"].kit ?? ""),
    min90_1week: Number(defaultAcademySettings.tuition["90min"]["1week"] ?? 0),
    min90_2week: Number(defaultAcademySettings.tuition["90min"]["2week"] ?? 0),
    min90_fee: Number(defaultAcademySettings.tuition["90min"].fee ?? 0),
    min90_kit: String(defaultAcademySettings.tuition["90min"].kit ?? ""),
    elite_monthly: Number(defaultAcademySettings.tuition.elite.monthly ?? 0),
    elite_fee: Number(defaultAcademySettings.tuition.elite.fee ?? 0),
    elite_kit: String(defaultAcademySettings.tuition.elite.kit ?? ""),
    adult_evening: Number(defaultAcademySettings.tuition.adult.evening ?? 0),
    adult_morning: Number(defaultAcademySettings.tuition.adult.morning ?? 0),
  });
  const [customClassPrices, setCustomClassPrices] = useState<CustomClassPrice[]>([
    {
      class_name: "",
      week1_price: 0,
      week2_price: 0,
      week3_price: 0,
      elite_price: 0,
      tryout_price: 0,
      shuttle_fee: 0,
      discount_percent: 0,
      discount_won: 0,
    },
  ]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [notices, setNotices] = useState<{ id: string; title: string; published_at: string }[]>([]);
  const [brandName, setBrandName] = useState(defaultSiteBranding.name);
  const [brandTitle, setBrandTitle] = useState(defaultSiteBranding.title);
  const [brandTagline, setBrandTagline] = useState(defaultSiteBranding.tagline);
  const [brandEmoji, setBrandEmoji] = useState(defaultSiteBranding.emoji);
  const [brandTrialIntro, setBrandTrialIntro] = useState(defaultSiteBranding.trial_intro);
  const [brandFooterAddress, setBrandFooterAddress] = useState(defaultSiteBranding.footer_address);
  const [brandFooterPhone, setBrandFooterPhone] = useState(defaultSiteBranding.footer_phone);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sRes, nRes] = await Promise.all([
        authFetch("/api/admin/parent-settings"),
        authFetch("/api/admin/public-notices"),
      ]);
      const sJson = await sRes.json();
      const nJson = await nRes.json();
      if (!sRes.ok) {
        setError(sJson.error ?? "설정을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const map = Object.fromEntries(
        (sJson.data as { setting_key: string; setting_value: unknown }[]).map((r) => [
          r.setting_key,
          r.setting_value,
        ])
      );
      if (Array.isArray(map.preparation_items)) {
        setPreparationText((map.preparation_items as string[]).join("\n"));
      }
      if (map.shuttle_info && typeof map.shuttle_info === "object") {
        setShuttleJson(JSON.stringify(map.shuttle_info, null, 2));
      }
      if (map.payment_guide && typeof map.payment_guide === "object") {
        setPaymentJson(JSON.stringify(map.payment_guide, null, 2));
      }
      if (map.makeup_policy && typeof map.makeup_policy === "object") {
        setMakeupJson(JSON.stringify(map.makeup_policy, null, 2));
      }
      if (map.refund_policy && typeof map.refund_policy === "object") {
        setRefundJson(JSON.stringify(map.refund_policy, null, 2));
      }
      if (map.tuition && typeof map.tuition === "object") {
        const t = map.tuition as Record<string, any>;
        const t60 = (t["60min"] ?? {}) as Record<string, any>;
        const t90 = (t["90min"] ?? {}) as Record<string, any>;
        const te = (t.elite ?? {}) as Record<string, any>;
        const ta = (t.adult ?? {}) as Record<string, any>;
        setTuitionForm({
          min60_1week: Number(t60["1week"] ?? 0),
          min60_2week: Number(t60["2week"] ?? 0),
          min60_fee: Number(t60.fee ?? 0),
          min60_kit: String(t60.kit ?? ""),
          min90_1week: Number(t90["1week"] ?? 0),
          min90_2week: Number(t90["2week"] ?? 0),
          min90_fee: Number(t90.fee ?? 0),
          min90_kit: String(t90.kit ?? ""),
          elite_monthly: Number(te.monthly ?? 0),
          elite_fee: Number(te.fee ?? 0),
          elite_kit: String(te.kit ?? ""),
          adult_evening: Number(ta.evening ?? 0),
          adult_morning: Number(ta.morning ?? 0),
        });
        const customRows = Array.isArray(t.custom_classes)
          ? (t.custom_classes as Record<string, unknown>[]).map((row) => ({
              class_name: String(row.class_name ?? ""),
              week1_price: Number(row.week1_price ?? 0),
              week2_price: Number(row.week2_price ?? 0),
              week3_price: Number(row.week3_price ?? 0),
              elite_price: Number(row.elite_price ?? 0),
              tryout_price: Number(row.tryout_price ?? 0),
              shuttle_fee: Number(row.shuttle_fee ?? 0),
              discount_percent: Number(row.discount_percent ?? 0),
              discount_won: Number(row.discount_won ?? 0),
            }))
          : [];
        setCustomClassPrices(
          customRows.length > 0
            ? customRows
            : [
                {
                  class_name: "",
                  week1_price: 0,
                  week2_price: 0,
                  week3_price: 0,
                  elite_price: 0,
                  tryout_price: 0,
                  shuttle_fee: 0,
                  discount_percent: 0,
                  discount_won: 0,
                },
              ]
        );
      }
      if (map.site_branding !== undefined) {
        const b = mergeSiteBranding(map.site_branding);
        setBrandName(b.name);
        setBrandTitle(b.title);
        setBrandTagline(b.tagline);
        setBrandEmoji(b.emoji);
        setBrandTrialIntro(b.trial_intro);
        setBrandFooterAddress(b.footer_address);
        setBrandFooterPhone(b.footer_phone);
      }
      if (nRes.ok && nJson.data) {
        setNotices(
          nJson.data.map((x: { id: string; title: string; published_at: string }) => ({
            id: x.id,
            title: x.title,
            published_at: x.published_at,
          }))
        );
      }
    } catch {
      setError("네트워크 오류");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveKey(key: string, value: unknown) {
    setMessage("");
    setError("");
    const res = await authFetch("/api/admin/parent-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settingKey: key, settingValue: value }),
    });
    let json: { error?: string } = {};
    try {
      json = (await res.json()) as { error?: string };
    } catch {
      setError(res.status === 401 ? "로그인이 필요합니다." : "저장 응답을 읽지 못했습니다.");
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "저장 실패");
      return;
    }
    setMessage("저장되었습니다.");
  }

  async function saveBranding() {
    await saveKey("site_branding", {
      name: brandName.trim(),
      title: brandTitle.trim(),
      tagline: brandTagline.trim(),
      emoji: brandEmoji.trim(),
      trial_intro: brandTrialIntro.trim(),
      footer_address: brandFooterAddress.trim(),
      footer_phone: brandFooterPhone.trim(),
    });
  }

  async function savePreparation() {
    const lines = preparationText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    await saveKey("preparation_items", lines);
  }

  async function saveJson(key: string, raw: string) {
    try {
      const parsed = JSON.parse(raw);
      await saveKey(key, parsed);
    } catch {
      setError("JSON 형식이 올바르지 않습니다.");
    }
  }

  async function saveTuitionForm() {
    await saveKey("tuition", {
      "60min": {
        "1week": Number(tuitionForm.min60_1week ?? 0),
        "2week": Number(tuitionForm.min60_2week ?? 0),
        fee: Number(tuitionForm.min60_fee ?? 0),
        kit: tuitionForm.min60_kit.trim(),
      },
      "90min": {
        "1week": Number(tuitionForm.min90_1week ?? 0),
        "2week": Number(tuitionForm.min90_2week ?? 0),
        fee: Number(tuitionForm.min90_fee ?? 0),
        kit: tuitionForm.min90_kit.trim(),
      },
      elite: {
        monthly: Number(tuitionForm.elite_monthly ?? 0),
        fee: Number(tuitionForm.elite_fee ?? 0),
        kit: tuitionForm.elite_kit.trim(),
      },
      adult: {
        evening: Number(tuitionForm.adult_evening ?? 0),
        morning: Number(tuitionForm.adult_morning ?? 0),
      },
      custom_classes: customClassPrices
        .filter((row) => row.class_name.trim().length > 0)
        .map((row) => ({
          class_name: row.class_name.trim(),
          week1_price: Number(row.week1_price ?? 0),
          week2_price: Number(row.week2_price ?? 0),
          week3_price: Number(row.week3_price ?? 0),
          elite_price: Number(row.elite_price ?? 0),
          tryout_price: Number(row.tryout_price ?? 0),
          shuttle_fee: Number(row.shuttle_fee ?? 0),
          discount_percent: Number(row.discount_percent ?? 0),
          discount_won: Number(row.discount_won ?? 0),
        })),
    });
  }

  async function postNotice() {
    setMessage("");
    setError("");
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      setError("제목과 내용을 입력하세요.");
      return;
    }
    const res = await authFetch("/api/admin/public-notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        category: "announcement",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "등록 실패");
      return;
    }
    setNoticeTitle("");
    setNoticeContent("");
    setMessage("공지가 등록되었습니다.");
    void load();
  }

  const addCustomClassRow = () => {
    setCustomClassPrices((prev) => [
      ...prev,
      {
        class_name: "",
        week1_price: 0,
        week2_price: 0,
        week3_price: 0,
        elite_price: 0,
        tryout_price: 0,
        shuttle_fee: 0,
        discount_percent: 0,
        discount_won: 0,
      },
    ]);
  };

  const removeCustomClassRow = (idx: number) => {
    setCustomClassPrices((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, index) => index !== idx)
    );
  };

  const updateCustomClassRow = (
    idx: number,
    key: keyof CustomClassPrice,
    value: string | number
  ) => {
    setCustomClassPrices((prev) =>
      prev.map((row, index) =>
        index === idx
          ? {
              ...row,
              [key]:
                key === "class_name"
                  ? String(value)
                  : Number(value),
            }
          : row
      )
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-2">
        <Link
          href="/admin/parent-site"
          className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
        >
          ← 학부모 사이트
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">학부모 사이트 설정</h1>
        <Link
          href="/parents"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-sky-600 underline"
        >
          공개 페이지 미리보기 ↗
        </Link>
      </div>
      <p className="mb-6 text-sm text-zinc-600">
        수강료·안내 문구는 JSON으로 저장됩니다. 관리자 권한이 필요합니다.
      </p>

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-600">{message}</p> : null}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-700">
        {(
          [
            ["branding", "사이트명"],
            ["preparation", "준비물"],
            ["shuttle", "셔틀"],
            ["payment", "결제"],
            ["makeup", "보강"],
            ["refund", "환불"],
            ["tuition", "수강료"],
            ["notices", "공지 등록"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === k
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-zinc-500">불러오는 중…</p> : null}

      {!loading && tab === "branding" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">사이트명·문구</h2>
          <p className="text-sm text-zinc-600">
            학부모 공개 페이지 상단, 배너, 푸터, 브라우저 탭 제목에 반영됩니다. 체험 안내 문구에는{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{"{name}"}</code>를 넣으면 짧은 이름으로
            바뀝니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-zinc-600">짧은 이름 (헤더·푸터·저작권)</span>
              <input
                className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">이모지 (선택, 헤더 앞)</span>
              <input
                className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={brandEmoji}
                onChange={(e) => setBrandEmoji(e.target.value)}
                placeholder="🏐"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600">배너 큰 제목 (탭 제목에도 사용)</span>
              <input
                className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={brandTitle}
                onChange={(e) => setBrandTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600">배너 부제</span>
              <input
                className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={brandTagline}
                onChange={(e) => setBrandTagline(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600">체험 모달 안내 문구</span>
              <textarea
                className="mt-1 min-h-[72px] w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={brandTrialIntro}
                onChange={(e) => setBrandTrialIntro(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600">푸터 주소</span>
              <input
                className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={brandFooterAddress}
                onChange={(e) => setBrandFooterAddress(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600">푸터 전화</span>
              <input
                className="mt-1 w-full rounded border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900"
                value={brandFooterPhone}
                onChange={(e) => setBrandFooterPhone(e.target.value)}
                placeholder="전화: 02-0000-0000"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveBranding()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            저장
          </button>
        </section>
      ) : null}

      {!loading && tab === "preparation" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">준비물 (한 줄에 하나씩)</h2>
          <textarea
            className="min-h-[200px] w-full rounded border border-zinc-300 p-3 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={preparationText}
            onChange={(e) => setPreparationText(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void savePreparation()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            저장
          </button>
        </section>
      ) : null}

      {!loading && tab === "shuttle" ? (
        <JsonEditorTab title="셔틀 안내 (JSON)" value={shuttleJson} onChange={setShuttleJson} onSave={() => saveJson("shuttle_info", shuttleJson)} />
      ) : null}
      {!loading && tab === "payment" ? (
        <JsonEditorTab title="결제 안내 (JSON)" value={paymentJson} onChange={setPaymentJson} onSave={() => saveJson("payment_guide", paymentJson)} />
      ) : null}
      {!loading && tab === "makeup" ? (
        <JsonEditorTab title="보강 정책 (JSON)" value={makeupJson} onChange={setMakeupJson} onSave={() => saveJson("makeup_policy", makeupJson)} />
      ) : null}
      {!loading && tab === "refund" ? (
        <JsonEditorTab title="환불 정책 (JSON)" value={refundJson} onChange={setRefundJson} onSave={() => saveJson("refund_policy", refundJson)} />
      ) : null}
      {!loading && tab === "tuition" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">수강료 입력</h2>
          <p className="text-sm text-zinc-600">숫자만 입력하면 됩니다. 저장 시 공개 페이지에 바로 반영됩니다.</p>

          <div className="grid gap-3 rounded-lg border p-3 dark:border-zinc-700">
            <h3 className="text-sm font-semibold">60분 클래스</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">주 1회(월4회)
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.min60_1week} onChange={(e) => setTuitionForm((p) => ({ ...p, min60_1week: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">주 2회(월8회)
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.min60_2week} onChange={(e) => setTuitionForm((p) => ({ ...p, min60_2week: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">입회비
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.min60_fee} onChange={(e) => setTuitionForm((p) => ({ ...p, min60_fee: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">웰컴키트 문구
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" value={tuitionForm.min60_kit} onChange={(e) => setTuitionForm((p) => ({ ...p, min60_kit: e.target.value }))} />
              </label>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-3 dark:border-zinc-700">
            <h3 className="text-sm font-semibold">90분 클래스</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">주 1회(월4회)
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.min90_1week} onChange={(e) => setTuitionForm((p) => ({ ...p, min90_1week: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">주 2회(월8회)
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.min90_2week} onChange={(e) => setTuitionForm((p) => ({ ...p, min90_2week: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">입회비
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.min90_fee} onChange={(e) => setTuitionForm((p) => ({ ...p, min90_fee: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">웰컴키트 문구
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" value={tuitionForm.min90_kit} onChange={(e) => setTuitionForm((p) => ({ ...p, min90_kit: e.target.value }))} />
              </label>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-3 dark:border-zinc-700">
            <h3 className="text-sm font-semibold">대표팀 / 성인반</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">대표팀 월수강료
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.elite_monthly} onChange={(e) => setTuitionForm((p) => ({ ...p, elite_monthly: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">대표팀 입회비
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.elite_fee} onChange={(e) => setTuitionForm((p) => ({ ...p, elite_fee: Number(e.target.value) }))} />
              </label>
              <label className="text-sm sm:col-span-2">대표팀 제공물품 문구
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" value={tuitionForm.elite_kit} onChange={(e) => setTuitionForm((p) => ({ ...p, elite_kit: e.target.value }))} />
              </label>
              <label className="text-sm">성인 저녁반
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.adult_evening} onChange={(e) => setTuitionForm((p) => ({ ...p, adult_evening: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">성인 오전반
                <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={tuitionForm.adult_morning} onChange={(e) => setTuitionForm((p) => ({ ...p, adult_morning: Number(e.target.value) }))} />
              </label>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-3 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">반이름/요금 추가 설정</h3>
              <button
                type="button"
                onClick={addCustomClassRow}
                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
              >
                + 반 추가
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              반이름, 주1/주2/주3, 대표팀, 트라이아웃, 셔틀비, 할인(%, 원)까지 입력할 수 있습니다.
            </p>
            <div className="space-y-3">
              {customClassPrices.map((row, idx) => (
                <div key={`custom-class-${idx}`} className="rounded border p-3 dark:border-zinc-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">반 #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomClassRow(idx)}
                      className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="text-xs sm:col-span-3">반이름
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" value={row.class_name} onChange={(e) => updateCustomClassRow(idx, "class_name", e.target.value)} />
                    </label>
                    <label className="text-xs">주 1회
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.week1_price} onChange={(e) => updateCustomClassRow(idx, "week1_price", e.target.value)} />
                    </label>
                    <label className="text-xs">주 2회
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.week2_price} onChange={(e) => updateCustomClassRow(idx, "week2_price", e.target.value)} />
                    </label>
                    <label className="text-xs">주 3회
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.week3_price} onChange={(e) => updateCustomClassRow(idx, "week3_price", e.target.value)} />
                    </label>
                    <label className="text-xs">대표팀
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.elite_price} onChange={(e) => updateCustomClassRow(idx, "elite_price", e.target.value)} />
                    </label>
                    <label className="text-xs">트라이아웃
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.tryout_price} onChange={(e) => updateCustomClassRow(idx, "tryout_price", e.target.value)} />
                    </label>
                    <label className="text-xs">셔틀비
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.shuttle_fee} onChange={(e) => updateCustomClassRow(idx, "shuttle_fee", e.target.value)} />
                    </label>
                    <label className="text-xs">할인 %
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.discount_percent} onChange={(e) => updateCustomClassRow(idx, "discount_percent", e.target.value)} />
                    </label>
                    <label className="text-xs">할인 원
                      <input className="mt-1 w-full rounded border p-2 dark:border-zinc-600 dark:bg-zinc-900" type="number" value={row.discount_won} onChange={(e) => updateCustomClassRow(idx, "discount_won", e.target.value)} />
                    </label>
                  </div>
                  <div className="mt-3 rounded bg-zinc-50 p-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    할인 적용 자동계산: 주1회 {toWonText(applyDiscount(row.week1_price, row.discount_percent, row.discount_won))} /
                    주2회 {toWonText(applyDiscount(row.week2_price, row.discount_percent, row.discount_won))} /
                    주3회 {toWonText(applyDiscount(row.week3_price, row.discount_percent, row.discount_won))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void saveTuitionForm()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            저장
          </button>
        </section>
      ) : null}

      {!loading && tab === "notices" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">공지 등록</h2>
          <input
            className="w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="제목"
            value={noticeTitle}
            onChange={(e) => setNoticeTitle(e.target.value)}
          />
          <textarea
            className="min-h-[160px] w-full rounded border border-zinc-300 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="내용 (HTML 가능)"
            value={noticeContent}
            onChange={(e) => setNoticeContent(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void postNotice()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            공지 등록
          </button>
          <div>
            <h3 className="mt-6 text-sm font-medium text-zinc-500">최근 공지</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {notices.map((n) => (
                <li key={n.id}>
                  {new Date(n.published_at).toLocaleDateString("ko-KR")} — {n.title}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function JsonEditorTab({
  title,
  value,
  onChange,
  onSave,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      <textarea
        className="min-h-[280px] w-full rounded border border-zinc-300 p-3 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={onSave}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        저장
      </button>
    </section>
  );
}
