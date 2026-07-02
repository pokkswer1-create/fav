"use client";

import { defaultAcademySettings, mergeSiteBranding } from "@/lib/parent-site/defaults";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type PublicNotice = {
  id: string;
  title: string;
  content: string;
  category: string;
  published_at: string;
  image_url?: string | null;
};

type ClassOption = {
  id: string;
  name: string;
  dayOfWeek: string;
  startTime: string;
  monthlyFee: number;
  makeupCapacity: number;
};

type CustomClassPrice = {
  class_name?: string;
  week1_price?: number;
  week2_price?: number;
  week3_price?: number;
  elite_price?: number;
  tryout_price?: number;
  shuttle_fee?: number;
  discount_percent?: number;
  discount_won?: number;
};

function previewText(htmlOrText: string, max = 72): string {
  const t = htmlOrText.replace(/<[^>]+>/g, "").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

function applyDiscount(base: number, discountPercent = 0, discountWon = 0) {
  const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const wonDiscount = Math.max(0, Number(discountWon) || 0);
  return Math.max(0, Math.round((Number(base) || 0) - ((Number(base) || 0) * pct) / 100 - wonDiscount));
}

export function ParentSiteHome() {
  const [settings, setSettings] = useState<Record<string, unknown>>(defaultAcademySettings as unknown as Record<string, unknown>);
  const [notices, setNotices] = useState<PublicNotice[]>([]);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [noticeDetail, setNoticeDetail] = useState<PublicNotice | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch(`/api/public/data?_ts=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? "데이터를 불러오지 못했습니다.");
        return;
      }
      if (json.settings) {
        setSettings({ ...defaultAcademySettings, ...json.settings } as Record<string, unknown>);
      }
      setNotices(json.notices ?? []);
    } catch {
      setLoadError("네트워크 오류입니다.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const tuition = settings.tuition as typeof defaultAcademySettings.tuition | undefined;
  const customClasses = ((settings.tuition as { custom_classes?: CustomClassPrice[] } | undefined)?.custom_classes ??
    []) as CustomClassPrice[];
  const preparation = (settings.preparation_items as string[]) ?? defaultAcademySettings.preparation_items;
  const shuttle = (settings.shuttle_info as Record<string, string>) ?? defaultAcademySettings.shuttle_info;
  const payment = (settings.payment_guide as Record<string, string>) ?? defaultAcademySettings.payment_guide;
  const makeup = (settings.makeup_policy as Record<string, string>) ?? defaultAcademySettings.makeup_policy;
  const refund = settings.refund_policy as { bullets?: string[] } | undefined;

  const refundBullets = useMemo(() => {
    if (refund?.bullets?.length) return refund.bullets;
    return defaultAcademySettings.refund_policy.bullets;
  }, [refund]);

  const brand = useMemo(() => mergeSiteBranding(settings.site_branding), [settings.site_branding]);
  const trialIntroText = useMemo(
    () => brand.trial_intro.replace(/\{name\}/g, brand.name),
    [brand.trial_intro, brand.name]
  );

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#333]">
      <header className="flex items-center justify-between bg-white px-5 py-4 shadow-sm">
        <div className="text-xl font-bold text-[#0095f6]">
          {brand.emoji?.trim() ? `${brand.emoji.trim()} ` : ""}
          {brand.name}
        </div>
        <nav className="flex flex-wrap gap-4 text-[13px]">
          <a href="#announcements" className="hover:text-[#0095f6]">
            공지사항
          </a>
          <a href="#classes" className="hover:text-[#0095f6]">
            수업안내
          </a>
          <a href="#info" className="hover:text-[#0095f6]">
            센터정보
          </a>
        </nav>
      </header>

      <section className="bg-gradient-to-br from-[#0095f6] to-[#0076d4] px-5 py-14 text-center text-white">
        <h1 className="mb-4 text-3xl font-bold md:text-4xl">{brand.title}</h1>
        <p className="mb-2 text-base opacity-90">{brand.tagline}</p>
      </section>

      <div className="relative z-10 mx-auto -mt-10 mb-10 grid max-w-[1200px] grid-cols-2 gap-3 px-5 md:grid-cols-3 lg:grid-cols-5">
        <ActionBtn primary label="🎯 체험수업 신청" onClick={() => setModal("trial")} />
        <ActionBtn primary label="📋 정규수업 신청" onClick={() => setModal("regular")} />
        <ActionBtn primary label="🏆 대표팀 신청" onClick={() => setModal("elite")} />
        <ActionBtn label="🔄 보강신청" onClick={() => setModal("makeup")} />
        <ActionBtn label="📦 준비물 안내" onClick={() => setModal("preparation")} />
      </div>

      {loadError ? (
        <p className="mx-auto max-w-[1200px] px-5 text-center text-sm text-rose-600">{loadError}</p>
      ) : null}

      <div className="mx-auto max-w-[1200px] space-y-8 px-5 pb-16">
        <section id="announcements" className="rounded-lg bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-5 border-b-[3px] border-[#0095f6] pb-2 text-2xl font-semibold">📢 공지사항</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notices.slice(0, 6).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNoticeDetail(n)}
                className="cursor-pointer rounded-md border border-[#e0e0e0] bg-[#f9f9f9] p-5 text-left transition hover:border-[#0095f6] hover:shadow-md"
              >
                <div className="mb-2 text-xs text-[#999]">
                  {new Date(n.published_at).toLocaleDateString("ko-KR")}
                </div>
                <div className="mb-2 font-bold leading-snug">{n.title}</div>
                <div className="text-[13px] leading-relaxed text-[#666]">{previewText(n.content)}</div>
              </button>
            ))}
          </div>
          {notices.length === 0 ? (
            <p className="text-sm text-zinc-500">등록된 공지가 없습니다. 관리자에서 추가해 주세요.</p>
          ) : null}
        </section>

        <section id="classes" className="rounded-lg bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-5 border-b-[3px] border-[#0095f6] pb-2 text-2xl font-semibold">💰 수강료 안내</h2>
          <PricingBlock title="60분 클래스" tuition={tuition?.["60min"]} />
          <PricingBlock title="90분 클래스" tuition={tuition?.["90min"]} />
          <PricingElite elite={tuition?.elite} />
          <PricingAdult adult={tuition?.adult} />
          {customClasses.length > 0 ? (
            <div className="mb-4">
              <h3 className="mb-3 text-base font-semibold">반별 상세 요금</h3>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#0095f6] text-left text-white">
                    <th className="p-2">반이름</th>
                    <th className="p-2">주1회</th>
                    <th className="p-2">주2회</th>
                    <th className="p-2">주3회</th>
                    <th className="p-2">할인적용(주2)</th>
                    <th className="p-2">대표팀</th>
                    <th className="p-2">트라이아웃</th>
                    <th className="p-2">셔틀비</th>
                    <th className="p-2">할인(%)</th>
                    <th className="p-2">할인(원)</th>
                  </tr>
                </thead>
                <tbody>
                  {customClasses.map((row, idx) => (
                    <tr key={`${row.class_name ?? "class"}-${idx}`} className="border-b border-[#e0e0e0]">
                      <td className="p-2">{row.class_name ?? "-"}</td>
                      <td className="p-2">{row.week1_price ? won(row.week1_price) : "-"}</td>
                      <td className="p-2">{row.week2_price ? won(row.week2_price) : "-"}</td>
                      <td className="p-2">{row.week3_price ? won(row.week3_price) : "-"}</td>
                      <td className="p-2">
                        {row.week2_price
                          ? won(applyDiscount(row.week2_price, row.discount_percent, row.discount_won))
                          : "-"}
                      </td>
                      <td className="p-2">{row.elite_price ? won(row.elite_price) : "-"}</td>
                      <td className="p-2">{row.tryout_price ? won(row.tryout_price) : "-"}</td>
                      <td className="p-2">{row.shuttle_fee ? won(row.shuttle_fee) : "-"}</td>
                      <td className="p-2">{row.discount_percent ? `${row.discount_percent}%` : "-"}</td>
                      <td className="p-2">{row.discount_won ? won(row.discount_won) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section id="info" className="rounded-lg bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-5 border-b-[3px] border-[#0095f6] pb-2 text-2xl font-semibold">ℹ️ 센터 안내</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <InfoBox title="📦 준비물 안내">
              <ul className="list-none space-y-2 p-0 text-[13px] leading-relaxed text-[#666]">
                {preparation.map((item, i) => (
                  <li key={i} className="border-b border-[#e0e0e0] py-2 last:border-0">
                    🔸 {item}
                  </li>
                ))}
              </ul>
            </InfoBox>
            <InfoBox title="🚐 셔틀 안내">
              <ul className="list-none space-y-2 p-0 text-[13px] text-[#666]">
                <li className="border-b border-[#e0e0e0] py-2">
                  <strong className="text-[#333]">유소년 클래스:</strong> {shuttle.youth}
                </li>
                <li className="border-b border-[#e0e0e0] py-2">
                  <strong className="text-[#333]">성인반:</strong> {shuttle.adult}
                </li>
                <li className="py-2">{shuttle.schedule}</li>
              </ul>
            </InfoBox>
            <InfoBox title="💳 결제 안내">
              <ul className="list-none space-y-2 p-0 text-[13px] text-[#666]">
                <li className="border-b border-[#e0e0e0] py-2">🔸 {payment.info1}</li>
                <li className="border-b border-[#e0e0e0] py-2">🔸 {payment.info2}</li>
                <li className="border-b border-[#e0e0e0] py-2">🔸 {payment.info3}</li>
                <li className="py-2">🔸 {payment.info4}</li>
              </ul>
            </InfoBox>
            <InfoBox title="🔄 보강 정책">
              <ul className="list-none space-y-2 p-0 text-[13px] text-[#666]">
                <li className="border-b border-[#e0e0e0] py-2">🔸 60분: {makeup.min60}</li>
                <li className="border-b border-[#e0e0e0] py-2">🔸 90분: {makeup.min90}</li>
                <li className="border-b border-[#e0e0e0] py-2">🔸 대표팀: {makeup.elite}</li>
                <li className="py-2">🔸 성인: {makeup.adult}</li>
              </ul>
            </InfoBox>
            <InfoBox title="💬 환불 정책">
              <ol className="ml-4 list-decimal space-y-2 p-0 text-[13px] leading-relaxed text-[#666]">
                {refundBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ol>
            </InfoBox>
          </div>
        </section>
      </div>

      <footer className="mt-10 bg-[#333] px-5 py-10 text-center text-xs text-white">
        <div className="mx-auto grid max-w-[1200px] gap-8 text-left md:grid-cols-3">
          <div>
            <h4 className="mb-2 text-[13px]">{brand.name}</h4>
            <p className="leading-relaxed opacity-80">{brand.footer_address}</p>
            <p className="leading-relaxed opacity-80">{brand.footer_phone}</p>
          </div>
          <div>
            <h4 className="mb-2 text-[13px]">운영시간</h4>
            <p className="leading-relaxed opacity-80">평일: 16:00 ~ 21:30</p>
            <p className="leading-relaxed opacity-80">토요일: 10:00 ~ 18:00</p>
            <p className="leading-relaxed opacity-80">일요일: 휴무</p>
          </div>
          <div>
            <h4 className="mb-2 text-[13px]">커뮤니티</h4>
            <p className="opacity-80">
              <span className="text-white/90">네이버 카페 · 카카오 오픈채팅 링크는 운영 정책에 맞게 연결하세요.</span>
            </p>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-[1200px] border-t border-white/20 pt-6">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </footer>

      {modal === "trial" ? (
        <TrialModal trialIntro={trialIntroText} onClose={() => setModal(null)} />
      ) : null}
      {modal === "regular" ? <RegularModal onClose={() => setModal(null)} /> : null}
      {modal === "elite" ? <EliteModal onClose={() => setModal(null)} /> : null}
      {modal === "makeup" ? <MakeupModal onClose={() => setModal(null)} /> : null}
      {modal === "preparation" ? (
        <PreparationModal preparation={preparation} onClose={() => setModal(null)} />
      ) : null}

      {noticeDetail ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-2 text-xs text-zinc-500">
              {new Date(noticeDetail.published_at).toLocaleString("ko-KR")}
            </div>
            <h3 className="mb-4 text-lg font-bold">{noticeDetail.title}</h3>
            {noticeDetail.content.includes("<") ? (
              <div
                className="prose prose-sm max-w-none text-zinc-700"
                dangerouslySetInnerHTML={{ __html: noticeDetail.content }}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {noticeDetail.content}
              </p>
            )}
            <button
              type="button"
              className="mt-6 w-full rounded bg-[#0095f6] py-2 font-medium text-white"
              onClick={() => setNoticeDetail(null)}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 border-[#0095f6] px-4 py-5 text-center text-[15px] font-bold shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${
        primary
          ? "bg-[#0095f6] text-white hover:bg-[#0085e0]"
          : "bg-white text-[#0095f6] hover:bg-[#0095f6] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function InfoBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border-l-4 border-[#0095f6] bg-[#f9f9f9] p-6">
      <h3 className="mb-4 text-lg font-semibold text-[#333]">{title}</h3>
      {children}
    </div>
  );
}

function PricingBlock({
  title,
  tuition: t,
}: {
  title: string;
  tuition?: { "1week"?: number; "2week"?: number; fee?: number; kit?: string };
}) {
  if (!t) return null;
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#0095f6] text-left text-white">
            <th className="p-3">수업명</th>
            <th className="p-3">수강료</th>
            <th className="p-3">입회비</th>
            <th className="p-3">웰컴키트</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#e0e0e0] hover:bg-[#f5f5f5]">
            <td className="p-3">주 1회 (월 4회)</td>
            <td className="p-3">{t["1week"] != null ? won(t["1week"]) : "-"}</td>
            <td className="p-3">{t.fee != null ? won(t.fee) : "-"}</td>
            <td className="p-3">{t.kit ?? "-"}</td>
          </tr>
          <tr className="border-b border-[#e0e0e0] hover:bg-[#f5f5f5]">
            <td className="p-3">주 2회 (월 8회)</td>
            <td className="p-3">{t["2week"] != null ? won(t["2week"]) : "-"}</td>
            <td className="p-3">{t.fee != null ? won(t.fee) : "-"}</td>
            <td className="p-3">{t.kit ?? "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PricingElite({ elite }: { elite?: { monthly?: number; fee?: number; kit?: string } }) {
  if (!elite) return null;
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-base font-semibold">U-15/18 대표팀 클래스</h3>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#0095f6] text-left text-white">
            <th className="p-3">항목</th>
            <th className="p-3">금액</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#e0e0e0]">
            <td className="p-3">월 수강료</td>
            <td className="p-3">{elite.monthly != null ? won(elite.monthly) : "-"}</td>
          </tr>
          <tr className="border-b border-[#e0e0e0]">
            <td className="p-3">입회비</td>
            <td className="p-3">{elite.fee != null ? won(elite.fee) : "-"}</td>
          </tr>
          <tr className="border-b border-[#e0e0e0]">
            <td className="p-3">제공 물품</td>
            <td className="p-3">{elite.kit ?? "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PricingAdult({ adult }: { adult?: { evening?: number; morning?: number } }) {
  if (!adult) return null;
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-base font-semibold">성인 클래스</h3>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#0095f6] text-left text-white">
            <th className="p-3">반</th>
            <th className="p-3">수강료</th>
            <th className="p-3">입회비</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#e0e0e0]">
            <td className="p-3">저녁 성인반(주 2회)</td>
            <td className="p-3">{adult.evening != null ? won(adult.evening) : "-"}</td>
            <td className="p-3">없음</td>
          </tr>
          <tr className="border-b border-[#e0e0e0]">
            <td className="p-3">오전 여성반(주 3회)</td>
            <td className="p-3">{adult.morning != null ? won(adult.morning) : "-"}</td>
            <td className="p-3">없음</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <button
          type="button"
          className="absolute right-3 top-3 text-3xl leading-none text-zinc-400 hover:text-zinc-800"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <h2 className="mb-2 text-xl font-bold text-[#333]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function TrialModal({ trialIntro, onClose }: { trialIntro: string; onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/public/classes?type=trial")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setClasses(d);
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(formRef.current!);
    const body = {
      studentName: fd.get("studentName"),
      age: fd.get("age") ? Number(fd.get("age")) : null,
      phone: fd.get("phone"),
      school: fd.get("school"),
      parentPhone: fd.get("parentPhone"),
      parentName: fd.get("parentName"),
      appliedClassId: fd.get("appliedClassId") || null,
      agreePersonalInfo: fd.get("agreePersonalInfo") === "on",
      agreeRefundPolicy: fd.get("agreeRefundPolicy") === "on",
    };
    const res = await fetch("/api/public/applications/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? "오류");
      return;
    }
    await fetch("/api/public/payment/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: json.id, applicationType: "trial" }),
    });
    alert("신청이 접수되었습니다. 결제·상세 안내는 학원에서 연락드립니다.");
    onClose();
  }

  return (
    <ModalShell title="🎯 체험수업 신청" onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-600">{trialIntro}</p>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        {classes.length > 0 ? (
          <label className="block text-sm font-semibold">
            희망 체험 반 (선택)
            <select
              name="appliedClassId"
              className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
            >
              <option value="">— 선택 안 함 —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.dayOfWeek} {c.startTime})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Field label="수강생 이름 *" name="studentName" required />
        <Field label="나이 *" name="age" type="number" min={5} max={100} required />
        <Field label="전화번호 *" name="phone" type="tel" required placeholder="010-0000-0000" />
        <Field label="학교 *" name="school" required placeholder="OO초등학교" />
        <Field label="부모님 전화번호 *" name="parentPhone" type="tel" required />
        <Field label="부모님 이름" name="parentName" />
        <AgreementBlock />
        {msg ? <p className="text-sm text-rose-600">{msg}</p> : null}
        <button
          type="submit"
          className="mt-4 w-full rounded bg-[#0095f6] py-3 font-bold text-white hover:bg-[#0085e0]"
        >
          신청 및 결제 안내
        </button>
      </form>
    </ModalShell>
  );
}

function RegularModal({ onClose }: { onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [tuitionHint, setTuitionHint] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/public/classes?type=regular")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setClasses(d);
      });
  }, []);

  function onClassChange(id: string) {
    const c = classes.find((x) => x.id === id);
    setTuitionHint(c ? `💰 수강료: ${won(c.monthlyFee)}/월` : "");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(formRef.current!);
    const body = {
      appliedClassId: fd.get("appliedClassId"),
      studentName: fd.get("studentName"),
      age: fd.get("age") ? Number(fd.get("age")) : null,
      phone: fd.get("phone"),
      school: fd.get("school"),
      address: fd.get("address"),
      parentPhone: fd.get("parentPhone"),
      parentName: fd.get("parentName"),
      needsShuttle: fd.get("needsShuttle") === "on",
      agreePersonalInfo: fd.get("agreePersonalInfo") === "on",
      agreeRefundPolicy: fd.get("agreeRefundPolicy") === "on",
    };
    const res = await fetch("/api/public/applications/regular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? "오류");
      return;
    }
    await fetch("/api/public/payment/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: json.id, applicationType: "regular" }),
    });
    alert("신청이 완료되었습니다. 상담원이 연락드리겠습니다.");
    onClose();
  }

  return (
    <ModalShell title="📋 정규수업 신청" onClose={onClose}>
      <p className="mb-4 text-sm font-bold text-rose-500">⚠️ 상담 후 신청을 진행하시기 바랍니다.</p>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-semibold">
          반 선택 *
          <select
            name="appliedClassId"
            required
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
            onChange={(e) => onClassChange(e.target.value)}
          >
            <option value="">— 반 선택 —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.dayOfWeek} {c.startTime})
              </option>
            ))}
          </select>
        </label>
        {tuitionHint ? <p className="text-sm text-[#0095f6]">{tuitionHint}</p> : null}
        <Field label="수강생 이름 *" name="studentName" required />
        <Field label="나이 *" name="age" type="number" min={5} max={100} required />
        <Field label="전화번호 *" name="phone" type="tel" required />
        <Field label="학교 *" name="school" required />
        <Field label="주소 *" name="address" required />
        <Field label="부모님 전화번호 *" name="parentPhone" type="tel" required />
        <Field label="부모님 이름" name="parentName" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="needsShuttle" className="accent-[#0095f6]" />
          셔틀 서비스 필요
        </label>
        <AgreementBlock />
        {msg ? <p className="text-sm text-rose-600">{msg}</p> : null}
        <button
          type="submit"
          className="w-full rounded bg-[#0095f6] py-3 font-bold text-white hover:bg-[#0085e0]"
        >
          신청 및 결제 안내
        </button>
      </form>
    </ModalShell>
  );
}

function EliteModal({ onClose }: { onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState("");
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(formRef.current!);
    const body = {
      studentName: fd.get("studentName"),
      age: fd.get("age") ? Number(fd.get("age")) : null,
      phone: fd.get("phone"),
      school: fd.get("school"),
      parentPhone: fd.get("parentPhone"),
      parentName: fd.get("parentName"),
      agreePersonalInfo: fd.get("agreePersonalInfo") === "on",
      agreeActivityConsent: fd.get("agreeActivityConsent") === "on",
    };
    const res = await fetch("/api/public/applications/elite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? "오류");
      return;
    }
    alert("대표팀 테스트 신청이 접수되었습니다.");
    onClose();
  }
  return (
    <ModalShell title="🏆 대표팀 테스트 신청" onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-600">
        엘리트 선수가 아닌 생활체육 대회 출전을 위한 교실입니다.
      </p>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <Field label="수강생 이름 *" name="studentName" required />
        <Field label="나이 *" name="age" type="number" min={10} max={20} required />
        <Field label="전화번호 *" name="phone" type="tel" required />
        <Field label="학교 *" name="school" required />
        <Field label="부모님 전화번호 *" name="parentPhone" type="tel" required />
        <Field label="부모님 이름" name="parentName" />
        <div className="rounded-md bg-zinc-50 p-4 text-sm">
          <label className="flex gap-2">
            <input type="checkbox" name="agreePersonalInfo" className="mt-1 accent-[#0095f6]" required />
            개인정보 수집에 동의합니다.
          </label>
          <label className="mt-3 flex gap-2">
            <input type="checkbox" name="agreeActivityConsent" className="mt-1 accent-[#0095f6]" required />
            <span>
              <strong>대표팀 활동 및 대회 출전에 동의합니다.</strong>
            </span>
          </label>
          <p className="mt-2 text-xs text-zinc-600">
            정기 훈련·대회 참가, 촬영 공개, 출전비 별도, 출석 관리 등에 동의합니다.
          </p>
        </div>
        {msg ? <p className="text-sm text-rose-600">{msg}</p> : null}
        <button
          type="submit"
          className="w-full rounded bg-[#0095f6] py-3 font-bold text-white hover:bg-[#0085e0]"
        >
          테스트 신청하기
        </button>
      </form>
    </ModalShell>
  );
}

function MakeupModal({ onClose }: { onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [avail, setAvail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/public/classes?type=makeup_available")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setClasses(d);
      });
  }, []);

  function onSelChange(id: string) {
    const c = classes.find((x) => x.id === id);
    if (!c) {
      setAvail("");
      return;
    }
    if (c.makeupCapacity > 0) {
      setAvail(`✅ 신청 가능 인원 기준: ${c.makeupCapacity}명 (운영 정책에 따라 조정될 수 있습니다)`);
    } else {
      setAvail("❌ 현재 신청 불가능할 수 있습니다");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(formRef.current!);
    const body = {
      makeupClassId: fd.get("makeupClassId"),
      studentName: fd.get("studentName"),
      age: fd.get("age") ? Number(fd.get("age")) : null,
      phone: fd.get("phone"),
      parentPhone: fd.get("parentPhone"),
      preferredDate: fd.get("preferredDate"),
      preferredTime: fd.get("preferredTime"),
      agreePersonalInfo: fd.get("agreePersonalInfo") === "on",
      agreeGuidelineConsent: fd.get("agreeGuidelineConsent") === "on",
    };
    const res = await fetch("/api/public/applications/makeup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? "오류");
      return;
    }
    alert("보강 신청이 접수되었습니다.");
    onClose();
  }

  return (
    <ModalShell title="🔄 보강신청" onClose={onClose}>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-semibold">
          보강 가능 반 *
          <select
            name="makeupClassId"
            required
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
            onChange={(e) => onSelChange(e.target.value)}
          >
            <option value="">— 반 선택 —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (가능: {c.makeupCapacity}명)
              </option>
            ))}
          </select>
        </label>
        {avail ? (
          <p
            className={`text-sm ${avail.startsWith("✅") ? "text-emerald-600" : "text-rose-600"}`}
          >
            {avail}
          </p>
        ) : null}
        {classes.length === 0 ? (
          <p className="text-sm text-amber-700">
            보강 신청 가능으로 표시된 반이 없습니다. 관리자에서 클래스의 보강 가능 인원(makeup_capacity)을 설정하세요.
          </p>
        ) : null}
        <Field label="수강생 이름 *" name="studentName" required />
        <Field label="나이 *" name="age" type="number" required />
        <Field label="전화번호 *" name="phone" type="tel" required />
        <Field label="부모님 전화번호 *" name="parentPhone" type="tel" required />
        <Field label="선호 날짜 *" name="preferredDate" type="date" required />
        <Field label="선호 시간 *" name="preferredTime" type="time" required />
        <div className="rounded-md bg-zinc-50 p-4 text-sm">
          <label className="flex gap-2">
            <input type="checkbox" name="agreePersonalInfo" className="mt-1 accent-[#0095f6]" required />
            개인정보 수집에 동의합니다.
          </label>
          <label className="mt-3 flex gap-2">
            <input type="checkbox" name="agreeGuidelineConsent" className="mt-1 accent-[#0095f6]" required />
            보강 안내를 확인하고 동의합니다.
          </label>
        </div>
        {msg ? <p className="text-sm text-rose-600">{msg}</p> : null}
        <button
          type="submit"
          className="w-full rounded bg-[#0095f6] py-3 font-bold text-white hover:bg-[#0085e0]"
        >
          보강신청하기
        </button>
      </form>
    </ModalShell>
  );
}

function PreparationModal({
  preparation,
  onClose,
}: {
  preparation: string[];
  onClose: () => void;
}) {
  return (
    <ModalShell title="📦 수업 준비물 안내" onClose={onClose}>
      <div className="mt-4 space-y-4 text-[13px] leading-relaxed text-zinc-600">
        <div className="border-l-4 border-[#0095f6] bg-zinc-50 p-4">
          <h3 className="mb-2 font-bold text-zinc-800">실내전용 운동화</h3>
          <p>실내 전용 운동화 착용이 필수입니다.</p>
        </div>
        <div className="border-l-4 border-[#0095f6] bg-zinc-50 p-4">
          <h3 className="mb-2 font-bold text-zinc-800">음식물 반입 제한</h3>
          <p>쾌적한 환경을 위해 음식물 반입을 제한합니다.</p>
        </div>
        <div className="border-l-4 border-[#0095f6] bg-zinc-50 p-4">
          <h3 className="mb-2 font-bold text-zinc-800">개인 물통</h3>
          <p>개인 물통을 지참해 주세요.</p>
        </div>
        <div className="border-l-4 border-[#0095f6] bg-zinc-50 p-4">
          <h3 className="mb-2 font-bold text-zinc-800">관리자 등록 준비물</h3>
          <ul className="list-disc pl-5">
            {preparation.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </ModalShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm font-normal"
      />
    </label>
  );
}

function AgreementBlock() {
  return (
    <div className="space-y-4 rounded-md bg-zinc-50 p-4 text-sm">
      <h3 className="font-bold">동의사항</h3>
      <label className="flex gap-2">
        <input type="checkbox" name="agreePersonalInfo" className="mt-1 accent-[#0095f6]" required />
        개인정보 수집에 동의합니다.
      </label>
      <p className="ml-6 text-xs text-zinc-500">이름·연락처 등은 상담·운영 목적으로 1년 보관 후 파기됩니다.</p>
      <label className="flex gap-2">
        <input type="checkbox" name="agreeRefundPolicy" className="mt-1 accent-[#0095f6]" required />
        환불정책에 동의합니다.
      </label>
      <div className="ml-6 rounded bg-white p-3 text-xs leading-relaxed text-zinc-600">
        학원법 기준 환불 규정을 준수합니다. 자세한 내용은 하단 센터 안내를 참고하세요.
      </div>
    </div>
  );
}
