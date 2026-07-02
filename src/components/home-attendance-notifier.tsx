"use client";

import { hmToTotalMinutes, koreaHourMinute, koreaTimeTotalMinutes } from "@/lib/datetime/korea";
import { useCallback, useEffect, useRef, useState } from "react";

type SnapshotClass = {
  classId: string;
  name: string;
  startTime: string;
  enrolledCount: number;
  presentCount: number;
  absentCount: number;
  unmarkedCount: number;
  absentNames: string[];
};

type Snapshot = {
  date: string;
  classes: SnapshotClass[];
};

function digestStorageKey(date: string) {
  return `home-attendance-digest-v1-${date}`;
}

function slotStorageKey(classId: string, date: string, start: string) {
  return `home-attendance-slot-v1-${classId}-${date}-${start}`;
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

export function HomeAttendanceNotifier() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState("");
  const permissionRef = useRef<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      permissionRef.current = Notification.permission;
    }
  }, []);

  const fetchSnapshot = useCallback(async (): Promise<Snapshot | null> => {
    const res = await fetch("/api/home/attendance-snapshot");
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as Snapshot;
  }, []);

  const applySnapshot = useCallback(
    async (opts: { pushNotifications: boolean; forceDigest?: boolean }) => {
      const snap = await fetchSnapshot();
      if (!snap) return;

      const digestLines: string[] = [];
      for (const c of snap.classes) {
        const abs =
          c.absentNames.length > 0 ? c.absentNames.join(", ") : "없음";
        digestLines.push(
          `${c.name}: 결석 ${c.absentCount}명 (${abs}) / 출석등 ${c.presentCount}명 / 미입력 ${c.unmarkedCount}명`
        );
      }
      const digestBody =
        snap.classes.length === 0
          ? `오늘(${snap.date}) 진행 반 없음`
          : digestLines.join("\n");

      setPreview(digestBody);

      if (!opts.pushNotifications || permissionRef.current !== "granted") return;

      const { hour: hourNum } = koreaHourMinute();
      const digestKey = digestStorageKey(snap.date);
      const shouldDigest =
        (opts.forceDigest || hourNum >= 6) &&
        typeof localStorage !== "undefined" &&
        localStorage.getItem(digestKey) !== "1";

      if (shouldDigest) {
        try {
          new Notification(`오늘(${snap.date}) 출석·결석`, {
            body: truncate(digestBody, 220),
            tag: `digest-${snap.date}`,
          });
          localStorage.setItem(digestKey, "1");
        } catch {
          /* ignore */
        }
      }

      const nowM = koreaTimeTotalMinutes();
      for (const c of snap.classes) {
        const startM = hmToTotalMinutes(c.startTime);
        const delta = nowM - startM;
        if (delta < 0 || delta > 14) continue;
        const sk = slotStorageKey(c.classId, snap.date, c.startTime);
        if (localStorage.getItem(sk) === "1") continue;
        const abs =
          c.absentNames.length > 0 ? c.absentNames.join(", ") : "없음";
        const body = `${c.name} — 출석 ${c.presentCount}명, 결석 ${c.absentCount}명 (결석: ${abs}), 미입력 ${c.unmarkedCount}명`;
        try {
          new Notification(`${c.name} (${c.startTime})`, {
            body: truncate(body, 200),
            tag: `slot-${c.classId}-${snap.date}-${c.startTime}`,
          });
          localStorage.setItem(sk, "1");
        } catch {
          /* ignore */
        }
      }
    },
    [fetchSnapshot]
  );

  const runNotifications = useCallback(async () => {
    await applySnapshot({ pushNotifications: enabled });
  }, [applySnapshot, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const initialTimer = window.setTimeout(() => {
      void runNotifications();
    }, 0);
    const t = window.setInterval(() => void runNotifications(), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(t);
    };
  }, [enabled, runNotifications]);

  const requestEnable = async () => {
    if (typeof Notification === "undefined") {
      setStatus("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }
    const p = await Notification.requestPermission();
    permissionRef.current = p;
    if (p !== "granted") {
      setStatus("알림 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.");
      return;
    }
    setStatus("알림이 켜졌습니다. 탭을 켜 둔 상태에서 수업 시작 시각 전후로 안내합니다.");
    setEnabled(true);
    await applySnapshot({ pushNotifications: true, forceDigest: true });
  };

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">오늘 출석·결석 알림</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        브라우저 알림으로 오늘 요일에 해당하는 반의 결석자와, 각 반 시작 시각(서울 기준) 전후 15분 안에 출석·결석
        인원을 알려줍니다. PC에서 해당 사이트 탭이 열려 있어야 주기적으로 확인할 수 있습니다.
      </p>
      {status ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{status}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!enabled ? (
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => void requestEnable()}
          >
            브라우저 알림 켜기
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            onClick={() => {
              setEnabled(false);
              setStatus("알림 추적을 멈췄습니다.");
            }}
          >
            알림 끄기
          </button>
        )}
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          onClick={() => void applySnapshot({ pushNotifications: enabled })}
        >
          지금 새로고침
        </button>
      </div>
      {preview ? (
        <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs whitespace-pre-wrap text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          <span className="font-medium">화면 미리보기</span>
          {"\n"}
          {preview}
        </div>
      ) : null}
    </section>
  );
}
