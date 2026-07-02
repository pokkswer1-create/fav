"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useState } from "react";

type ClassItem = { id: string; name: string };
type AnnouncementItem = {
  id: string;
  class_id: string | null;
  class_name: string;
  title: string;
  updated_at: string;
};

type TemplateForm = {
  id?: string;
  classId: string;
  className: string;
  title: string;
  content: string;
  navercafeUrl: string;
  openChatUrls: { title: string; url: string; code?: string }[];
  kakaoGroupUrls: { title: string; url: string }[];
  address: string;
  mapLink: string;
  preparationItems: string[];
  shuttleInfo: { youth: string; adult: string; schedule?: string };
  tuitionInfo: Record<string, unknown>;
  paymentGuide: string;
  makeupPolicy: string;
  refundPolicy: string;
  agreementItems: Record<string, boolean>;
  agreementDescription: string;
  externalFormUrl: string;
  expiryDate: string;
};

const initialForm: TemplateForm = {
  classId: "",
  className: "",
  title: "",
  content: "",
  navercafeUrl: "",
  openChatUrls: [{ title: "", url: "", code: "" }],
  kakaoGroupUrls: [{ title: "", url: "" }],
  address: "",
  mapLink: "",
  preparationItems: [""],
  shuttleInfo: { youth: "", adult: "", schedule: "" },
  tuitionInfo: {},
  paymentGuide: "",
  makeupPolicy: "",
  refundPolicy: "",
  agreementItems: {},
  agreementDescription: "",
  externalFormUrl: "",
  expiryDate: "",
};

export default function AnnouncementsAdminPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [form, setForm] = useState<TemplateForm>(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadClasses = async () => {
    const res = await authFetch("/api/classes");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "클래스 목록 조회 실패");
      return;
    }
    const list = (json.data ?? []).map((c: { id: string; name: string }) => ({
      id: c.id,
      name: c.name,
    }));
    setClasses(list);
  };

  const loadAnnouncements = async () => {
    const res = await authFetch("/api/announcements");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "안내 목록 조회 실패");
      return;
    }
    setAnnouncements(json.data ?? []);
  };

  useEffect(() => {
    void loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const fillFromAnnouncement = async (id: string) => {
    const res = await authFetch(`/api/announcements/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "상세 조회 실패");
      return;
    }
    const link = (json.class_application_links ?? [])[0];
    setForm({
      id: json.id,
      classId: json.class_id ?? "",
      className: json.class_name ?? "",
      title: json.title ?? "",
      content: json.content ?? "",
      navercafeUrl: json.navercafe_url ?? "",
      openChatUrls: json.open_chat_urls?.length ? json.open_chat_urls : [{ title: "", url: "", code: "" }],
      kakaoGroupUrls: json.kakao_group_urls?.length ? json.kakao_group_urls : [{ title: "", url: "" }],
      address: json.address ?? "",
      mapLink: json.map_link ?? "",
      preparationItems: json.preparation_items?.length ? json.preparation_items : [""],
      shuttleInfo: json.shuttle_info ?? { youth: "", adult: "", schedule: "" },
      tuitionInfo: json.tuition_info ?? {},
      paymentGuide: json.payment_guide ?? "",
      makeupPolicy: json.makeup_policy ?? "",
      refundPolicy: json.refund_policy ?? "",
      agreementItems: json.agreement_items ?? {},
      agreementDescription: json.agreement_description ?? "",
      externalFormUrl: link?.external_form_url ?? "",
      expiryDate: link?.expiry_date ?? "",
    });
  };

  const save = async () => {
    setError("");
    setMessage("");
    const payload = {
      ...form,
      classId: form.classId || null,
      className:
        form.className ||
        classes.find((c) => c.id === form.classId)?.name ||
        "",
      openChatUrls: form.openChatUrls.filter((x) => x.title || x.url),
      kakaoGroupUrls: form.kakaoGroupUrls.filter((x) => x.title || x.url),
      preparationItems: form.preparationItems.filter(Boolean),
    };
    const res = await authFetch("/api/announcements/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "저장 실패");
      return;
    }
    setMessage("안내 템플릿이 저장되었습니다.");
    await loadAnnouncements();
    if (json.id) {
      await fillFromAnnouncement(json.id);
    }
  };

  const removeAnnouncement = async () => {
    if (!form.id) return;
    const ok = window.confirm("이 안내를 비활성화하시겠습니까?");
    if (!ok) return;
    const res = await authFetch(`/api/announcements/${form.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "삭제 실패");
      return;
    }
    setMessage("안내가 비활성화되었습니다.");
    setForm(initialForm);
    await loadAnnouncements();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">클래스 안내 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setForm(initialForm)}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          + 새 템플릿
        </button>
      </section>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">템플릿 목록</h2>
        <div className="space-y-2">
          {announcements.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full rounded border border-zinc-200 px-3 py-2 text-left text-sm dark:border-zinc-800"
              onClick={() => fillFromAnnouncement(item.id)}
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-xs opacity-70">
                {item.class_name} · {new Date(item.updated_at).toLocaleString("ko-KR")}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-2">
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={form.classId}
          onChange={(e) => {
            const classId = e.target.value;
            const className = classes.find((c) => c.id === classId)?.name ?? "";
            setForm((p) => ({ ...p, classId, className }));
          }}
        >
          <option value="">클래스 선택(선택)</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="클래스명"
          value={form.className}
          onChange={(e) => setForm((p) => ({ ...p, className: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="제목"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
        <textarea
          className="min-h-36 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 md:col-span-2"
          placeholder="안내 내용(HTML/마크다운 가능)"
          value={form.content}
          onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="네이버 카페 URL"
          value={form.navercafeUrl}
          onChange={(e) => setForm((p) => ({ ...p, navercafeUrl: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="주소"
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="지도 링크"
          value={form.mapLink}
          onChange={(e) => setForm((p) => ({ ...p, mapLink: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="외부 신청 폼 URL"
          value={form.externalFormUrl}
          onChange={(e) => setForm((p) => ({ ...p, externalFormUrl: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="date"
          value={form.expiryDate}
          onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
        />
        <textarea
          className="min-h-24 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="보강 정책"
          value={form.makeupPolicy}
          onChange={(e) => setForm((p) => ({ ...p, makeupPolicy: e.target.value }))}
        />
        <textarea
          className="min-h-24 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="환불 정책"
          value={form.refundPolicy}
          onChange={(e) => setForm((p) => ({ ...p, refundPolicy: e.target.value }))}
        />
        <div className="md:col-span-2 flex gap-2">
          <button
            type="button"
            onClick={save}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            저장
          </button>
          {form.id ? (
            <button
              type="button"
              onClick={removeAnnouncement}
              className="rounded border border-rose-400 px-4 py-2 text-rose-600"
            >
              삭제
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
