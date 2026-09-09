"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { analyzeMatch, pct, scoreLabel } from "@/lib/analysis";
import { buildTeamHeatmap } from "@/lib/heatmap";
import { demoMatch } from "@/lib/demo-match";
import type { MatchAnalysis, MatchInput, PlayerRating } from "@/lib/types";
import { CourtHeatmap } from "./CourtHeatmap";
import { MatchSheetForm } from "./MatchSheetForm";
import { WingLogo } from "./SiteHeader";
import { getStoredMatch, saveStoredMatch, setEditorBridge, getScoutSession } from "@/lib/storage";
import { buildMarkdownReport, downloadTextFile, openPrintableReport } from "@/lib/report";
import { clipsFromScoutPoints } from "@/lib/scout";
import { alignClipsToDuration } from "@/lib/clip-align";
import { createDemoScoutSession } from "@/lib/demo-scout";
import { ProStatsPanels } from "./ProStatsPanels";
import { filterActionsToClips } from "@/lib/scout-filters";

function resolveScout(matchId: string) {
  return getScoutSession(matchId) ?? getScoutSession("demo-scout-session") ?? createDemoScoutSession();
}

function TeamCard({
  power,
  side,
  onPlayerCut,
}: {
  power: MatchAnalysis["home"];
  side: "home" | "away";
  onPlayerCut: (p: PlayerRating) => void;
}) {
  return (
    <article className={`team-panel ${power.isFav ? "is-fav" : ""}`}>
      <div className="team-panel-head">
        {power.isFav ? <WingLogo size={42} /> : <span className="opp-mark">VS</span>}
        <div>
          <p className="eyebrow">{side === "home" ? "HOME" : "AWAY"}</p>
          <h3>{power.teamName}</h3>
        </div>
        <div className="grade-pill" aria-label={`전력 등급 ${scoreLabel(power.overall)}`}>
          <strong>{scoreLabel(power.overall)}</strong>
          <span>{power.overall.toFixed(0)}</span>
        </div>
      </div>

      <dl className="stat-grid">
        <div>
          <dt>공격효율</dt>
          <dd>{pct(power.attackEfficiency)}</dd>
        </div>
        <div>
          <dt>킬률</dt>
          <dd>{pct(power.killRate)}</dd>
        </div>
        <div>
          <dt>블로킹</dt>
          <dd>{power.blockPoints}</dd>
        </div>
        <div>
          <dt>에이스</dt>
          <dd>{power.aceTotal}</dd>
        </div>
        <div>
          <dt>디그</dt>
          <dd>{power.digTotal}</dd>
        </div>
        <div>
          <dt>리시브실수</dt>
          <dd>{pct(power.receptionErrorRate)}</dd>
        </div>
      </dl>

      <div className="split-lists">
        <div>
          <h4>강점</h4>
          <ul>
            {power.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>약점</h4>
          <ul>
            {power.weaknesses.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <h4>핵심 선수</h4>
      <ul className="player-list">
        {power.keyPlayers.map((p) => (
          <li key={p.playerId}>
            <span className="num">#{p.number}</span>
            <span className="name">
              {p.name} <em>{p.position}</em>
            </span>
            <span className="score">{p.overall.toFixed(0)}</span>
            <span className="tags">{p.tags.slice(0, 2).join(" · ")}</span>
            <button type="button" className="btn ghost player-cut-btn" onClick={() => onPlayerCut(p)}>
              이 선수 컷
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function AnalysisWorkbench() {
  const router = useRouter();
  const search = useSearchParams();
  const [match, setMatch] = useState<MatchInput>(() => structuredClone(demoMatch));
  const [inputMode, setInputMode] = useState<"sheet" | "json">("sheet");
  const [matchJson, setMatchJson] = useState(() => JSON.stringify(demoMatch, null, 2));
  const [report, setReport] = useState<MatchAnalysis>(() => analyzeMatch(demoMatch));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const matchId = search.get("match");
    if (!matchId) return;
    const stored = getStoredMatch(matchId);
    if (!stored) {
      setError("보관함에서 경기를 찾지 못했습니다.");
      return;
    }
    setMatch(stored.match);
    setMatchJson(JSON.stringify(stored.match, null, 2));
    setReport(stored.analysis ?? analyzeMatch(stored.match));
    setStatus(`보관함 경기 로드: ${stored.match.title}`);
  }, [search]);

  const heatmaps = useMemo(
    () => ({
      home: buildTeamHeatmap(match.home, report.home),
      away: buildTeamHeatmap(match.away, report.away),
    }),
    [match, report],
  );

  const scoutLive = useMemo(() => resolveScout(match.id), [match.id, report, status]);

  const setLine = useMemo(() => {
    return `${report.home.shortName} ${report.setScore} ${report.away.shortName}`;
  }, [report]);

  function syncJsonFromMatch(next: MatchInput) {
    setMatch(next);
    setMatchJson(JSON.stringify(next, null, 2));
  }

  function runAnalyze(source?: MatchInput) {
    try {
      setBusy(true);
      setError(null);
      let parsed = source;
      if (!parsed) {
        if (inputMode === "json") parsed = JSON.parse(matchJson) as MatchInput;
        else parsed = match;
      }
      const nextReport = analyzeMatch(parsed);
      setMatch(parsed);
      setMatchJson(JSON.stringify(parsed, null, 2));
      setReport(nextReport);
      setStatus("분석 완료");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setBusy(false);
    }
  }

  function loadDemo() {
    const next = structuredClone(demoMatch);
    syncJsonFromMatch(next);
    setReport(analyzeMatch(next));
    setError(null);
    setStatus("데모 경기 로드 완료 — 오른쪽 결과를 확인하세요");
    // Keep the status near the action buttons so the click is obvious.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function saveLibrary() {
    saveStoredMatch({
      id: match.id,
      savedAt: new Date().toISOString(),
      match,
      analysis: report,
    });
    setStatus("보관함에 저장했습니다.");
  }

  function exportReport() {
    const scout = resolveScout(match.id);
    const md = buildMarkdownReport(match, report, scout);
    downloadTextFile(`${match.home.shortName}-report.md`, md, "text/markdown");
    setStatus("마크다운 리포트 다운로드");
  }

  function printReport() {
    const scout = resolveScout(match.id);
    const md = buildMarkdownReport(match, report, scout);
    openPrintableReport(md, match.title);
  }

  function sendPlayerToEditor(p: PlayerRating) {
    const scout = resolveScout(match.id);
    const fromScout = alignClipsToDuration(
      clipsFromScoutPoints(scout.points, 20, { onlyPlayerNumber: p.number }),
      20,
    );

    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "analyze",
      playerNumber: p.number,
      playerName: p.name,
      autoTrack: fromScout.length === 0,
      clips: fromScout.length ? fromScout : undefined,
      matchId: match.id,
      message:
        fromScout.length > 0
          ? `#${p.number} 스카우트 타임스탬프 컷 (정확)`
          : `#${p.number} OCR/기록 트래킹 실행`,
    });
    router.push("/editor?bridge=1");
  }

  function sendSuggestionsToEditor() {
    const scout = resolveScout(match.id);
    const fromActions = filterActionsToClips(scout.actions ?? [], { durationSec: 20 });
    const clips = alignClipsToDuration(
      fromActions.length ? fromActions : clipsFromScoutPoints(scout.points, 20),
      20,
    );
    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "analyze",
      clips: clips.length ? clips : undefined,
      autoTrack: false,
      matchId: match.id,
      message: clips.length
        ? fromActions.length
          ? "프로 코딩 기반 전체 컷"
          : "스카우트 기반 전체 컷"
        : "편집기에서 장면 감지를 실행하세요",
    });
    router.push(clips.length ? "/editor?bridge=1" : "/editor");
  }

  function sendSkillFilterToEditor(skill: "A" | "S" | "B") {
    const scout = resolveScout(match.id);
    const clips = filterActionsToClips(scout.actions ?? [], {
      skill,
      team: "home",
      durationSec: 20,
    });
    if (!clips.length) {
      setStatus(`${skill} 코딩 타임스탬프가 없습니다. 스카우트에서 프로 코딩을 하세요.`);
      return;
    }
    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "analyze",
      clips,
      matchId: match.id,
      mediaDurationSec: 20,
      message: `필터 ${skill} 홈 클립`,
    });
    router.push("/editor?bridge=1");
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">MATCH SCOUT</p>
        <h1>경기 넣으면 전력분석</h1>
        <p className="lede">
          스코어시트·스카우트 기록을 분석하고, 선수 컷/리포트/보관함까지 바로 연결합니다.
        </p>
      </section>

      <section className="editor-grid analyze-grid">
        <div className="json-pane sheet-pane">
          <div className="pane-actions">
            <button type="button" onClick={loadDemo} className="btn ghost">
              데모 경기
            </button>
            <button
              type="button"
              className={`btn ghost ${inputMode === "sheet" ? "is-active" : ""}`}
              onClick={() => setInputMode("sheet")}
            >
              스코어시트
            </button>
            <button
              type="button"
              className={`btn ghost ${inputMode === "json" ? "is-active" : ""}`}
              onClick={() => {
                setMatchJson(JSON.stringify(match, null, 2));
                setInputMode("json");
              }}
            >
              JSON
            </button>
            <button type="button" onClick={() => runAnalyze()} className="btn primary" disabled={busy}>
              {busy ? "분석 중…" : "전력분석 실행"}
            </button>
            <button type="button" className="btn ghost" onClick={saveLibrary}>
              보관함 저장
            </button>
            <button type="button" className="btn ghost" onClick={exportReport}>
              리포트 MD
            </button>
            <button type="button" className="btn ghost" onClick={printReport}>
              인쇄
            </button>
            <button type="button" className="btn primary" onClick={sendSuggestionsToEditor}>
              컷으로 보내기
            </button>
            <button type="button" className="btn ghost" onClick={() => sendSkillFilterToEditor("A")}>
              공격 컷
            </button>
            <button type="button" className="btn ghost" onClick={() => sendSkillFilterToEditor("S")}>
              서브 컷
            </button>
            <button type="button" className="btn ghost" onClick={() => sendSkillFilterToEditor("B")}>
              블로킹 컷
            </button>
          </div>
          {status ? <p className="status-line status-flash">{status}</p> : null}
          {error ? <p className="error-line">{error}</p> : null}

          {inputMode === "sheet" ? (
            <MatchSheetForm match={match} onChange={syncJsonFromMatch} />
          ) : (
            <>
              <label className="sr-only" htmlFor="match-json">
                경기 JSON
              </label>
              <textarea
                id="match-json"
                value={matchJson}
                onChange={(e) => setMatchJson(e.target.value)}
                spellCheck={false}
              />
            </>
          )}
        </div>

        <div className="report-pane">
          <div className="report-hero">
            <WingLogo size={56} />
            <div>
              <p className="eyebrow">{report.title}</p>
              <h2>{setLine}</h2>
              <p>
                승자 추정:{" "}
                {report.winner === "home"
                  ? report.home.teamName
                  : report.winner === "away"
                    ? report.away.teamName
                    : "세트 동률 / 접전"}
              </p>
            </div>
          </div>

          <div className="team-compare">
            <TeamCard power={report.home} side="home" onPlayerCut={sendPlayerToEditor} />
            <TeamCard power={report.away} side="away" onPlayerCut={sendPlayerToEditor} />
          </div>

          <section className="notes-block heat-block">
            <h3>코트 히트맵</h3>
            <div className="heat-compare">
              <CourtHeatmap heat={heatmaps.home} />
              <CourtHeatmap heat={heatmaps.away} />
            </div>
          </section>

          <ProStatsPanels
            scout={scoutLive}
            homeName={report.home.teamName}
            awayName={report.away.teamName}
          />

          <section className="notes-block">
            <h3>매치업 노트</h3>
            <ul>
              {report.matchupNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>

          <section className="notes-block">
            <h3>코칭 플랜</h3>
            <ol>
              {report.coachingPlan.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ol>
          </section>

          <section className="notes-block">
            <h3>영상 편집 추천 컷</h3>
            <ul className="clip-suggest">
              {report.highlightSuggestions.map((h) => (
                <li key={h.kind}>
                  <strong>{h.label}</strong>
                  <span>{h.reason}</span>
                  <em>~{h.preferredSeconds}s</em>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
