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
import { clipsFromScoutPoints, estimateMediaDurationFromScout } from "@/lib/scout";
import { alignClipsToDuration } from "@/lib/clip-align";
import { createDemoScoutSession } from "@/lib/demo-scout";
import { ProStatsPanels } from "./ProStatsPanels";
import { filterActionsToClips } from "@/lib/scout-filters";
import { ExplainedButton, HowToPanel } from "./UiGuide";

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
            <button type="button" className="btn ghost player-cut-btn" title="이 선수의 영상 컷을 편집기로 보냅니다" onClick={() => onPlayerCut(p)}>
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    const duration = estimateMediaDurationFromScout(scout);
    const fromScout = alignClipsToDuration(
      clipsFromScoutPoints(scout.points, duration, { onlyPlayerNumber: p.number }),
      duration,
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
      mediaDurationSec: duration,
      homeName: match.home.name,
      awayName: match.away.name,
      message:
        fromScout.length > 0
          ? `#${p.number} 스카우트 타임스탬프 컷 (정확)`
          : `#${p.number} OCR/기록 트래킹 실행`,
    });
    router.push("/editor?bridge=1");
  }

  function sendSuggestionsToEditor() {
    const scout = resolveScout(match.id);
    const duration = estimateMediaDurationFromScout(scout);
    const fromActions = filterActionsToClips(scout.actions ?? [], { durationSec: duration });
    const clips = alignClipsToDuration(
      fromActions.length ? fromActions : clipsFromScoutPoints(scout.points, duration),
      duration,
    );
    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "analyze",
      clips: clips.length ? clips : undefined,
      autoTrack: false,
      matchId: match.id,
      mediaDurationSec: duration,
      homeName: match.home.name,
      awayName: match.away.name,
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
    const duration = estimateMediaDurationFromScout(scout);
    const clips = filterActionsToClips(scout.actions ?? [], {
      skill,
      team: "home",
      durationSec: duration,
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
      mediaDurationSec: duration,
      homeName: match.home.name,
      awayName: match.away.name,
      message: `필터 ${skill} 홈 클립`,
    });
    router.push("/editor?bridge=1");
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">MATCH SCOUT</p>
        <h1>경기 넣으면 전력분석</h1>
        <p className="lede">먼저 데모로 결과를 보고, 필요하면 기록을 수정한 뒤 다시 분석하세요.</p>
      </section>

      <HowToPanel
        title="이렇게 쓰세요"
        steps={[
          "① 데모로 해보기 — 연습용 경기가 바로 채워집니다.",
          "② 전력분석 실행 — 오른쪽(또는 아래)에 등급·강약·히트맵이 나옵니다.",
          "③ (선택) 컷으로 보내기 — 영상 편집 화면으로 클립을 넘깁니다.",
        ]}
      />

      <section className="editor-grid analyze-grid">
        <div className="json-pane sheet-pane">
          <div className="action-simple">
            <ExplainedButton
              variant="primary"
              label="데모로 해보기"
              hint="연습용 FAV 경기를 불러옵니다"
              onClick={loadDemo}
            />
            <ExplainedButton
              variant="primary"
              label={busy ? "분석 중…" : "전력분석 실행"}
              hint="현재 입력한 기록으로 전력·강약을 계산합니다"
              onClick={() => runAnalyze()}
              disabled={busy}
            />
            <ExplainedButton
              label="컷으로 보내기"
              hint="스카우트/코딩 타임스탬프를 영상편집으로 보냅니다"
              onClick={sendSuggestionsToEditor}
            />
          </div>

          <div className="action-simple secondary">
            <ExplainedButton
              label="보관함 저장"
              hint="지금 경기·분석 결과를 이 기기에 저장합니다"
              onClick={saveLibrary}
            />
            <ExplainedButton
              label="리포트 받기"
              hint="마크다운 리포트 파일을 다운로드합니다"
              onClick={exportReport}
            />
            <button
              type="button"
              className={`btn ghost ${showAdvanced ? "is-active" : ""}`}
              onClick={() => setShowAdvanced((v) => !v)}
              title="입력 방식·인쇄·스킬별 컷 등"
            >
              {showAdvanced ? "고급 닫기" : "고급 기능"}
            </button>
          </div>

          {showAdvanced ? (
            <div className="advanced-box">
              <p className="hint">입력 방식과 세부 컷·인쇄는 여기에 모아 두었습니다.</p>
              <div className="action-simple secondary">
                <ExplainedButton
                  label="스코어시트"
                  hint="표로 선수 기록을 직접 수정합니다"
                  className={inputMode === "sheet" ? "is-active" : ""}
                  onClick={() => setInputMode("sheet")}
                />
                <ExplainedButton
                  label="JSON"
                  hint="경기 데이터를 JSON으로 붙여넣습니다"
                  className={inputMode === "json" ? "is-active" : ""}
                  onClick={() => {
                    setMatchJson(JSON.stringify(match, null, 2));
                    setInputMode("json");
                  }}
                />
                <ExplainedButton
                  label="인쇄"
                  hint="브라우저 인쇄 창을 엽니다"
                  onClick={printReport}
                />
                <ExplainedButton
                  label="공격 컷"
                  hint="홈팀 공격(A) 코딩만 영상편집으로 보냅니다"
                  onClick={() => sendSkillFilterToEditor("A")}
                />
                <ExplainedButton
                  label="서브 컷"
                  hint="홈팀 서브(S) 코딩만 보냅니다"
                  onClick={() => sendSkillFilterToEditor("S")}
                />
                <ExplainedButton
                  label="블로킹 컷"
                  hint="홈팀 블로킹(B) 코딩만 보냅니다"
                  onClick={() => sendSkillFilterToEditor("B")}
                />
              </div>
            </div>
          ) : null}

          {status ? <p className="status-line status-flash">{status}</p> : null}
          {error ? <p className="error-line">{error}</p> : null}

          <p className="section-label">경기 기록 입력</p>
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
          <p className="section-label">분석 결과</p>
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
            <p className="hint">포지션·기록 기반 활동 구역입니다. 진할수록 그 구역 비중이 큽니다.</p>
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
            <p className="hint">위 “컷으로 보내기”를 누르면 편집기로 넘어갑니다.</p>
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
