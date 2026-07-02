"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useState } from "react";

type ConnectionStatus = {
  connected: boolean;
  provider: "naver" | "kakao";
  connectedAt: string | null;
  expiresAt: string | null;
  scope: string | null;
  user: { id?: string | null; name?: string | null } | null;
  updatedAt: string | null;
};

const emptyStatus = (provider: "naver" | "kakao"): ConnectionStatus => ({
  connected: false,
  provider,
  connectedAt: null,
  expiresAt: null,
  scope: null,
  user: null,
  updatedAt: null,
});

export default function ChannelIntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [naver, setNaver] = useState<ConnectionStatus>(emptyStatus("naver"));
  const [kakao, setKakao] = useState<ConnectionStatus>(emptyStatus("kakao"));
  const [flash, setFlash] = useState<{ provider: string; status: string; message: string }>({
    provider: "",
    status: "",
    message: "",
  });

  const readFlashFromUrl = () => {
    const q = new URLSearchParams(window.location.search);
    setFlash({
      provider: q.get("provider") ?? "",
      status: q.get("status") ?? "",
      message: q.get("message") ?? "",
    });
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [nRes, kRes] = await Promise.all([
        authFetch("/api/integrations/naver-place"),
        authFetch("/api/integrations/kakao-channel"),
      ]);
      const nJson = await nRes.json();
      const kJson = await kRes.json();
      if (!nRes.ok || !kRes.ok) {
        setError(nJson.error ?? kJson.error ?? "연동 상태 조회에 실패했습니다.");
      } else {
        setNaver(nJson as ConnectionStatus);
        setKakao(kJson as ConnectionStatus);
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      readFlashFromUrl();
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const connect = async (provider: "naver-place" | "kakao-channel") => {
    setError("");
    const res = await authFetch(`/api/integrations/${provider}/start`);
    const json = (await res.json().catch(() => ({}))) as { authUrl?: string; error?: string };
    if (!res.ok || !json.authUrl) {
      setError(json.error ?? "연동 시작에 실패했습니다.");
      return;
    }
    window.location.href = json.authUrl;
  };

  const disconnect = async (provider: "naver-place" | "kakao-channel") => {
    setError("");
    const res = await authFetch(`/api/integrations/${provider}`, { method: "DELETE" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setError(json.error ?? "연동 해제에 실패했습니다.");
      return;
    }
    await load();
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">네이버/카카오 로그인 연동</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        관리자 계정으로 OAuth 로그인 후, 네이버 플레이스/카카오 채널 API 토큰을 연동합니다.
      </p>

      {flash.status === "connected" ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {flash.provider === "naver" ? "네이버" : "카카오"} 연동이 완료되었습니다.
        </p>
      ) : null}
      {flash.status === "error" ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          연동 실패: {flash.message || "원인을 확인해 주세요."}
        </p>
      ) : null}
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">불러오는 중...</p> : null}

      {!loading ? (
        <section className="grid gap-4 md:grid-cols-2">
          <ConnectionCard
            title="네이버 플레이스"
            status={naver}
            onConnect={() => void connect("naver-place")}
            onDisconnect={() => void disconnect("naver-place")}
          />
          <ConnectionCard
            title="카카오 채널"
            status={kakao}
            onConnect={() => void connect("kakao-channel")}
            onDisconnect={() => void disconnect("kakao-channel")}
          />
        </section>
      ) : null}
    </main>
  );
}

function ConnectionCard({
  title,
  status,
  onConnect,
  onDisconnect,
}: {
  title: string;
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <article className="rounded-xl border p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className={`mt-2 text-sm ${status.connected ? "text-emerald-600" : "text-zinc-500"}`}>
        {status.connected ? "연동됨" : "미연동"}
      </p>
      <div className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
        <p>계정명: {status.user?.name ?? "-"}</p>
        <p>계정 ID: {status.user?.id ?? "-"}</p>
        <p>권한(scope): {status.scope ?? "-"}</p>
        <p>연동 시각: {status.connectedAt ? new Date(status.connectedAt).toLocaleString("ko-KR") : "-"}</p>
        <p>토큰 만료: {status.expiresAt ? new Date(status.expiresAt).toLocaleString("ko-KR") : "-"}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onConnect}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          로그인 연동
        </button>
        {status.connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            연동 해제
          </button>
        ) : null}
      </div>
    </article>
  );
}

