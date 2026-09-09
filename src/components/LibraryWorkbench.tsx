"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDemoScoutSession } from "@/lib/demo-scout";
import { analyzeMatch, scoreLabel } from "@/lib/analysis";
import { buildMatchFromScout, clipsFromScoutPoints, type ScoutSession } from "@/lib/scout";
import { demoMatch } from "@/lib/demo-match";
import {
  deleteStoredMatch,
  listScoutSessions,
  listStoredMatches,
  saveScoutSession,
  saveStoredMatch,
  setEditorBridge,
  type StoredMatch,
} from "@/lib/storage";
import { alignClipsToDuration } from "@/lib/clip-align";
import { buildMarkdownReport, downloadTextFile, openPrintableReport } from "@/lib/report";

export function LibraryWorkbench() {
  const router = useRouter();
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [scouts, setScouts] = useState<ScoutSession[]>([]);

  function refresh() {
    setMatches(listStoredMatches());
    setScouts(listScoutSessions());
  }

  useEffect(() => {
    refresh();
  }, []);

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
    const clips = alignClipsToDuration(clipsFromScoutPoints(s.points, 20), 20);
    if (!clips.length) return;
    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "library",
      clips,
      matchId: s.matchId,
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
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">LIBRARY</p>
        <h1>경기 보관함</h1>
        <p className="lede">저장한 경기·스카우트를 다시 열고, 리포트를 내보내거나 영상 컷으로 보냅니다.</p>
      </section>

      <div className="pane-actions">
        <button type="button" className="btn ghost" onClick={seedDemo}>
          데모 시드
        </button>
        <button type="button" className="btn ghost" onClick={refresh}>
          새로고침
        </button>
      </div>

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

