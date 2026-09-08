"use client";

import { useMemo, useState } from "react";
import { analyzeMatch, pct, scoreLabel } from "@/lib/analysis";
import { demoMatch } from "@/lib/demo-match";
import type { MatchAnalysis, MatchInput } from "@/lib/types";
import { WingLogo } from "./SiteHeader";

function TeamCard({
  power,
  side,
}: {
  power: MatchAnalysis["home"];
  side: "home" | "away";
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
          </li>
        ))}
      </ul>
    </article>
  );
}

export function AnalysisWorkbench() {
  const [matchJson, setMatchJson] = useState(() => JSON.stringify(demoMatch, null, 2));
  const [report, setReport] = useState<MatchAnalysis>(() => analyzeMatch(demoMatch));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setLine = useMemo(() => {
    const home = report.home;
    const away = report.away;
    return `${home.shortName} ${report.setScore} ${away.shortName}`;
  }, [report]);

  function runLocal() {
    try {
      setBusy(true);
      setError(null);
      const parsed = JSON.parse(matchJson) as MatchInput;
      setReport(analyzeMatch(parsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 파싱 실패");
    } finally {
      setBusy(false);
    }
  }

  function loadDemo() {
    setMatchJson(JSON.stringify(demoMatch, null, 2));
    setReport(analyzeMatch(demoMatch));
    setError(null);
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">MATCH SCOUT</p>
        <h1>경기 넣으면 전력분석</h1>
        <p className="lede">
          선수별 공격·블로킹·서브·리시브 기록을 넣으면 FAV 기준 강약과 코칭 플랜을 바로 뽑습니다.
        </p>
      </section>

      <section className="editor-grid">
        <div className="json-pane">
          <div className="pane-actions">
            <button type="button" onClick={loadDemo} className="btn ghost">
              데모 경기 불러오기
            </button>
            <button type="button" onClick={runLocal} className="btn primary" disabled={busy}>
              {busy ? "분석 중…" : "전력분석 실행"}
            </button>
          </div>
          <label className="sr-only" htmlFor="match-json">
            경기 JSON
          </label>
          <textarea
            id="match-json"
            value={matchJson}
            onChange={(e) => setMatchJson(e.target.value)}
            spellCheck={false}
          />
          {error ? <p className="error-line">{error}</p> : null}
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
            <TeamCard power={report.home} side="home" />
            <TeamCard power={report.away} side="away" />
          </div>

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
