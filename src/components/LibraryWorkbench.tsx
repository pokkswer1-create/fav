"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDemoScoutSession } from "@/lib/demo-scout";
import { analyzeMatch, scoreLabel } from "@/lib/analysis";
import {
  buildMatchFromScout,
  clipsFromScoutPoints,
  estimateMediaDurationFromScout,
  type ScoutSession,
} from "@/lib/scout";
import { demoMatch } from "@/lib/demo-match";
import {
  applyLibraryBundle,
  buildCurrentLibraryBundle,
  deleteStoredMatch,
  downloadLibraryExport,
  importLibraryFromText,
  listScoutSessions,
  listStoredMatches,
  restoreLibraryFromIdb,
  saveScoutSession,
  saveStoredMatch,
  setEditorBridge,
  type StoredMatch,
} from "@/lib/storage";
import { alignClipsToDuration } from "@/lib/clip-align";
import { buildMarkdownReport, downloadTextFile, openPrintableReport } from "@/lib/report";
import { apiFetch } from "@/lib/api-client";
import type { LibraryBundle } from "@/lib/library-bundle";

export function LibraryWorkbench() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [scouts, setScouts] = useState<ScoutSession[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fivbQ, setFivbQ] = useState("VNL");
  const [fivbTournaments, setFivbTournaments] = useState<
    Array<{ no: number; name: string; code: string; startDate: string }>
  >([]);
  const [fivbMatches, setFivbMatches] = useState<
    Array<{ no: number; teamA?: string; teamB?: string; date?: string }>
  >([]);
  const [fivbStats, setFivbStats] = useState<Array<Record<string, string>>>([]);
  const [integrations, setIntegrations] = useState<string | null>(null);

  function refresh() {
    setMatches(listStoredMatches());
    setScouts(listScoutSessions());
  }

  useEffect(() => {
    void (async () => {
      await restoreLibraryFromIdb();
      refresh();
      try {
        const res = await apiFetch("/api/integrations");
        const data = (await res.json()) as {
          integrations?: {
            roboflow?: { configured?: boolean; model?: string };
            fivbVis?: { configured?: boolean };
            pydatavolley?: { note?: string };
          };
        };
        if (res.ok && data.integrations) {
          const r = data.integrations.roboflow;
          setIntegrations(
            `Roboflow ${r?.configured ? "ON" : "OFF"} (${r?.model ?? "-"}) · FIVB VIS · DVW/pydatavolley`,
          );
        }
      } catch {
        // optional
      }
    })();
  }, []);

  async function searchFivb() {
    try {
      setBusy(true);
      setFivbMatches([]);
      setFivbStats([]);
      const res = await apiFetch(`/api/fivb?q=${encodeURIComponent(fivbQ || "VNL")}`);
      const data = (await res.json()) as {
        error?: string;
        tournaments?: Array<{ no: number; name: string; code: string; startDate: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "FIVB 조회 실패");
      setFivbTournaments(data.tournaments ?? []);
      setStatus(`FIVB 토너먼트 ${data.tournaments?.length ?? 0}건`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "FIVB 조회 실패");
    } finally {
      setBusy(false);
    }
  }

  async function openFivbTournament(no: number) {
    try {
      setBusy(true);
      setFivbStats([]);
      const res = await apiFetch(`/api/fivb?tournament=${no}`);
      const data = (await res.json()) as {
        error?: string;
        matches?: Array<{ no: number; teamA?: string; teamB?: string; date?: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "경기 목록 실패");
      setFivbMatches(data.matches ?? []);
      setStatus(`토너먼트 #${no} 경기 ${data.matches?.length ?? 0}건`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "경기 목록 실패");
    } finally {
      setBusy(false);
    }
  }

  async function openFivbMatch(no: number) {
    try {
      setBusy(true);
      const res = await apiFetch(`/api/fivb?match=${no}`);
      const data = (await res.json()) as {
        error?: string;
        stats?: { playerRows?: Array<Record<string, string>> };
      };
      if (!res.ok) throw new Error(data.error ?? "스탯 조회 실패");
      setFivbStats(data.stats?.playerRows ?? []);
      setStatus(`매치 #${no} 스탯 행 ${data.stats?.playerRows?.length ?? 0}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "스탯 조회 실패");
    } finally {
      setBusy(false);
    }
  }

  function openAnalyze(id: string) {
    router.push(`/analyze?match=${encodeURIComponent(id)}`);
  }

  function exportReport(m: StoredMatch) {
    if (!m.analysis) return;
    const md = buildMarkdownReport(m.match, m.analysis);
    downloadTextFile(`${m.match.home.shortName}-report.md`, md, "text/markdown");
  }

  function printReport(m: StoredMatch) {
    if (!m.analysis) return;
    const md = buildMarkdownReport(m.match, m.analysis);
    openPrintableReport(md, m.match.title);
  }

  function sendScoutClips(s: ScoutSession) {
    const duration = estimateMediaDurationFromScout(s);
    const clips = alignClipsToDuration(clipsFromScoutPoints(s.points, duration), duration);
    if (!clips.length) return;
    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "library",
      clips,
      matchId: s.matchId,
      mediaDurationSec: duration,
      message: "보관함 스카우트 타임스탬프",
    });
    router.push("/editor?bridge=1");
  }

  function seedDemo() {
    const demo = createDemoScoutSession();
    const match = buildMatchFromScout(demo, {
      home: demoMatch.home.players,
      away: demoMatch.away.players,
    });
    const analysis = analyzeMatch(match);
    saveScoutSession(demo);
    saveStoredMatch({
      id: match.id,
      savedAt: new Date().toISOString(),
      match,
      analysis,
      notes: "demo seed",
    });
    refresh();
    setStatus("데모 시드 완료");
  }

  async function pushServerBackup() {
    try {
      setBusy(true);
      setStatus(null);
      const bundle = buildCurrentLibraryBundle();
      const res = await apiFetch("/api/library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
      const data = (await res.json()) as { error?: string; matchCount?: number; scoutCount?: number };
      if (!res.ok) throw new Error(data.error ?? "서버 백업 실패");
      setStatus(`서버 백업 완료 · 경기 ${data.matchCount} · 스카우트 ${data.scoutCount}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "서버 백업 실패");
    } finally {
      setBusy(false);
    }
  }

  async function pullServerBackup() {
    try {
      setBusy(true);
      setStatus(null);
      const res = await apiFetch("/api/library");
      const data = (await res.json()) as { error?: string; bundle?: LibraryBundle };
      if (!res.ok) throw new Error(data.error ?? "서버 불러오기 실패");
      if (!data.bundle) throw new Error("빈 백업");
      applyLibraryBundle(data.bundle, "merge");
      refresh();
      setStatus(
        `서버 병합 완료 · 경기 ${data.bundle.matches.length} · 스카우트 ${data.bundle.scouts.length}`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "서버 불러오기 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">LIBRARY</p>
        <h1>경기 보관함</h1>
        <p className="lede">
          localStorage + IndexedDB + JSON 내보내기/가져오기 + 서버 백업으로 기기 간 이동이 가능합니다.
          {integrations ? ` · 연동: ${integrations}` : ""}
        </p>
      </section>

      <section className="fivb-panel">
        <h2>FIVB VIS · 공개 대회 스탯</h2>
        <p className="hint">공식 VIS에서 토너먼트/경기/선수 스탯을 조회합니다 (읽기 전용).</p>
        <div className="pane-actions">
          <label>
            검색
            <input value={fivbQ} onChange={(e) => setFivbQ(e.target.value)} placeholder="VNL" />
          </label>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void searchFivb()}>
            FIVB 검색
          </button>
        </div>
        {fivbTournaments.length > 0 ? (
          <ul className="mark-list">
            {fivbTournaments.slice(0, 12).map((t) => (
              <li key={t.no}>
                <button type="button" className="mark-jump" onClick={() => void openFivbTournament(t.no)}>
                  #{t.no} {t.name} · {t.startDate || "날짜없음"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fivbMatches.length > 0 ? (
          <ul className="mark-list">
            {fivbMatches.slice(0, 15).map((m) => (
              <li key={m.no}>
                <button type="button" className="mark-jump" onClick={() => void openFivbMatch(m.no)}>
                  경기 #{m.no} {m.teamA ?? "?"} vs {m.teamB ?? "?"} · {m.date ?? ""}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fivbStats.length > 0 ? (
          <div className="fivb-stats">
            <p className="hint">선수 스탯 {fivbStats.length}행</p>
            <pre className="fivb-stats-pre">{JSON.stringify(fivbStats.slice(0, 12), null, 2)}</pre>
          </div>
        ) : null}
      </section>

      <div className="pane-actions">
        <button type="button" className="btn ghost" onClick={seedDemo}>
          데모 시드
        </button>
        <button type="button" className="btn ghost" onClick={refresh}>
          새로고침
        </button>
        <button type="button" className="btn ghost" onClick={() => downloadLibraryExport()}>
          JSON 내보내기
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          JSON 가져오기
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={pushServerBackup}>
          서버 백업
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={pullServerBackup}>
          서버에서 병합
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            try {
              const bundle = importLibraryFromText(text, "merge");
              refresh();
              setStatus(`가져오기 완료 · 경기 ${bundle.matches.length}`);
            } catch (err) {
              setStatus(err instanceof Error ? err.message : "가져오기 실패");
            }
            e.target.value = "";
          }}
        />
      </div>
      {status ? <p className="status-line">{status}</p> : null}

      <section className="library-grid">
        <div>
          <h3>저장된 경기 ({matches.length})</h3>
          <ul className="library-list">
            {matches.map((m) => (
              <li key={m.id}>
                <div>
                  <strong>{m.match.title}</strong>
                  <p>
                    {m.match.date} · {m.analysis ? `등급 ${scoreLabel(m.analysis.home.overall)}` : "미분석"} ·{" "}
                    {new Date(m.savedAt).toLocaleString()}
                  </p>
                </div>
                <div className="pane-actions">
                  <button type="button" className="btn ghost" onClick={() => openAnalyze(m.id)}>
                    분석
                  </button>
                  <button type="button" className="btn ghost" onClick={() => exportReport(m)}>
                    MD
                  </button>
                  <button type="button" className="btn ghost" onClick={() => printReport(m)}>
                    인쇄
                  </button>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => {
                      deleteStoredMatch(m.id);
                      refresh();
                    }}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
            {matches.length === 0 ? <li className="hint">아직 저장된 경기가 없습니다.</li> : null}
          </ul>
        </div>

        <div>
          <h3>스카우트 세션 ({scouts.length})</h3>
          <ul className="library-list">
            {scouts.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{s.title}</strong>
                  <p>
                    {s.points.length}포인트 · {s.homeName} vs {s.awayName}
                  </p>
                </div>
                <div className="pane-actions">
                  <button type="button" className="btn primary" onClick={() => sendScoutClips(s)}>
                    컷으로
                  </button>
                </div>
              </li>
            ))}
            {scouts.length === 0 ? <li className="hint">스카우트 세션이 없습니다.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
