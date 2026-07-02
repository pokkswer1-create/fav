"use client";

import { useCallback, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function HomeWebPush() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const subscribe = useCallback(async () => {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      setMsg("NEXT_PUBLIC_VAPID_PUBLIC_KEY와 VAPID_PRIVATE_KEY를 .env에 설정해 주세요.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMsg("이 브라우저는 웹 푸시를 지원하지 않습니다.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await reg.update();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setMsg(
        "웹 푸시 등록이 완료되었습니다. Vercel에 CRON_SECRET·웹 푸시 크론이 설정되어 있으면 탭을 닫아도 알림을 받을 수 있습니다."
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "등록 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setMsg("활성 구독이 없습니다.");
        return;
      }
      const json = sub.toJSON();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint }),
      });
      await sub.unsubscribe();
      setMsg("웹 푸시 구독을 해제했습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "해제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">웹 푸시 (탭 닫아도 알림)</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        HTTPS(또는 localhost)에서만 동작합니다. 매일 서울 8시대에 오늘 출석·결석 요약, 수업 시작 시각 전후에는 반별
        출석·결석 인원을 서버에서 푸시합니다. (Vercel <code className="text-xs">CRON_SECRET</code> 및{" "}
        <code className="text-xs">/api/batch/web-push-attendance</code> 크론 필요)
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          onClick={() => void subscribe()}
        >
          웹 푸시 등록
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          onClick={() => void unsubscribe()}
        >
          구독 해제
        </button>
      </div>
      {msg ? <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{msg}</p> : null}
    </section>
  );
}
