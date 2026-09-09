"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { demoMatch } from "@/lib/demo-match";
import { createDemoScoutSession } from "@/lib/demo-scout";
import {
  analyzeSideOut,
  buildMatchFromScout,
  clipsFromScoutPoints,
  computeSetScores,
  type PointTermination,
  type ScoutPoint,
  type ScoutSession,
  type TeamSide,
} from "@/lib/scout";
import { alignClipsToDuration } from "@/lib/clip-align";
import { saveScoutSession, saveStoredMatch, setEditorBridge } from "@/lib/storage";
import { analyzeMatch } from "@/lib/analysis";
import { WingLogo } from "./SiteHeader";

const TERMINATIONS: { value: PointTermination; label: string }[] = [
  { value: "kill", label: "킬" },
  { value: "ace", label: "에이스" },
  { value: "block", label: "블로킹" },
  { value: "opponent_error", label: "상대범실" },
  { value: "our_error", label: "우리범실" },
  { value: "other", label: "기타" },
];

function newId(): string {
  return `pt-${crypto.randomUUID().slice(0, 8)}`;
}

export function ScoutWorkbench() {
  const router = useRouter();
  const [session, setSession] = useState<ScoutSession>(() => ({
    id: crypto.randomUUID(),
    matchId: demoMatch.id,
    title: `${demoMatch.home.name} vs ${demoMatch.away.name}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    homeName: demoMatch.home.name,
    awayName: demoMatch.away.name,
    points: [],
  }));
  const [setIndex, setSetIndex] = useState(0);
  const [serving, setServing] = useState<TeamSide>("home");
  const [videoClock, setVideoClock] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState(demoMatch.home.players[0]?.id ?? "");
  const [status, setStatus] = useState<string | null>(null);

  const rosterHome = demoMatch.home.players;
  const rosterAway = demoMatch.away.players;
  const sets = useMemo(() => computeSetScores(session.points), [session.points]);
  const side = useMemo(() => analyzeSideOut(session.points), [session.points]);
  const currentSet = sets.find((s) => s.setIndex === setIndex) ?? {
    setIndex,
    home: 0,
    away: 0,
    winner: "none" as const,
  };

  const selectedPlayer =
    [...rosterHome, ...rosterAway].find((p) => p.id === selectedPlayerId) ?? rosterHome[0];

  function touch(next: ScoutSession) {
    setSession({ ...next, updatedAt: new Date().toISOString() });
  }

  function addPoint(winner: TeamSide, termination: PointTermination) {
    const ourPlayer =
      (winner === "home" && (termination === "kill" || termination === "ace" || termination === "block")) ||
      (winner === "away" && termination === "our_error")
        ? selectedPlayer
        : winner === "home" && termination === "opponent_error"
          ? undefined
          : winner === "home"
            ? selectedPlayer
            : selectedPlayer;

    const point: ScoutPoint = {
      id: newId(),
      setIndex,
      pointIndex: session.points.filter((p) => p.setIndex === setIndex).length,
      serving,
      winner,
      termination,
      playerId: ourPlayer?.id,
      playerNumber: ourPlayer?.number,
      playerName: ourPlayer?.name,
      videoTimeSec: Number(videoClock.toFixed(1)),
    };

    const points = [...session.points, point];
    // next serve: winner serves
    setServing(winner);
    touch({ ...session, points });
    setStatus(
      `S${setIndex + 1} ${(currentSet.home + (winner === "home" ? 1 : 0))}-${currentSet.away + (winner === "away" ? 1 : 0)} · ${termination} @ ${point.videoTimeSec}s`,
    );
  }

  function undo() {
    if (!session.points.length) return;
    const points = session.points.slice(0, -1);
    const last = points[points.length - 1];
    touch({ ...session, points });
    if (last) setServing(last.winner);
    setStatus("마지막 포인트 취소");
  }

  function loadDemo() {
    const demo = createDemoScoutSession();
    setSession(demo);
    setSetIndex(0);
    setServing("home");
    setStatus("데모 스카우트 로드 (영상 타임스탬프 포함)");
  }

  function saveAll() {
    const match = buildMatchFromScout(session, { home: rosterHome, away: rosterAway });
    const analysis = analyzeMatch(match);
    saveScoutSession(session);
    saveStoredMatch({
      id: session.matchId,
      savedAt: new Date().toISOString(),
      match,
      analysis,
      notes: `scout:${session.id}`,
    });
    setStatus("경기·스카우트 저장 완료 (보관함)");
  }

  function sendToEditor(onlyPlayer?: boolean) {
    const duration = 20; // sample video; editor will realign with ffprobe on render
    const raw = clipsFromScoutPoints(session.points, duration, {
      onlyPlayerNumber: onlyPlayer ? selectedPlayer?.number : undefined,
    });
    const clips = alignClipsToDuration(raw, duration);
    if (!clips.length) {
      setStatus("타임스탬프가 있는 포인트가 없습니다. 포인트 기록 시 영상 시계를 맞춰 주세요.");
      return;
    }
    saveAll();
    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "scout",
      playerNumber: onlyPlayer ? selectedPlayer?.number : undefined,
      playerName: onlyPlayer ? selectedPlayer?.name : undefined,
      clips,
      matchId: session.matchId,
      message: onlyPlayer
        ? `#${selectedPlayer?.number} 스카우트 타임스탬프 클립`
        : "스카우트 타임스탬프 전체 클립",
    });
    router.push("/editor?bridge=1");
  }

  function goAnalyze() {
    saveAll();
    router.push(`/analyze?match=${encodeURIComponent(session.matchId)}`);
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">LIVE SCOUT</p>
        <h1>포인트 스카우트</h1>
        <p className="lede">
          큰 버튼으로 포인트를 찍고, 영상 시계를 같이 남기면 나중에 어긋남 없이 선수/하이라이트 컷이
          됩니다.
        </p>
      </section>

      <div className="scout-scoreboard">
        <WingLogo size={40} />
        <div>
          <strong>
            {session.homeName} {currentSet.home} - {currentSet.away} {session.awayName}
          </strong>
          <p>
            SET {setIndex + 1} · 서브 {serving === "home" ? session.homeName : session.awayName} · 사이드아웃{" "}
            {(side.homeSideOutRate * 100).toFixed(0)}%/{(side.awaySideOutRate * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="scout-controls">
        <label>
          세트
          <select value={setIndex} onChange={(e) => setSetIndex(Number(e.target.value))}>
            {[0, 1, 2, 3, 4].map((i) => (
              <option key={i} value={i}>
                SET {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          서브
          <select value={serving} onChange={(e) => setServing(e.target.value as TeamSide)}>
            <option value="home">{session.homeName}</option>
            <option value="away">{session.awayName}</option>
          </select>
        </label>
        <label>
          선수
          <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
            <optgroup label={session.homeName}>
              {rosterHome.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={session.awayName}>
              {rosterAway.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          영상 시계(초)
          <input
            type="number"
            min={0}
            step={0.1}
            value={videoClock}
            onChange={(e) => setVideoClock(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className="scout-pad">
        <div className="scout-pad-col">
          <h3>{session.homeName} 득점</h3>
          <div className="scout-pad-grid">
            {TERMINATIONS.map((t) => (
              <button
                key={`h-${t.value}`}
                type="button"
                className="btn scout-btn"
                onClick={() => addPoint("home", t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="scout-pad-col">
          <h3>{session.awayName} 득점</h3>
          <div className="scout-pad-grid">
            {TERMINATIONS.map((t) => (
              <button
                key={`a-${t.value}`}
                type="button"
                className="btn scout-btn away"
                onClick={() => addPoint("away", t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pane-actions">
        <button type="button" className="btn ghost" onClick={undo}>
          실행취소
        </button>
        <button type="button" className="btn ghost" onClick={loadDemo}>
          데모 스카우트
        </button>
        <button type="button" className="btn ghost" onClick={saveAll}>
          저장
        </button>
        <button type="button" className="btn ghost" onClick={goAnalyze}>
          전력분석으로
        </button>
        <button type="button" className="btn primary" onClick={() => sendToEditor(false)}>
          타임스탬프 컷 → 편집
        </button>
        <button type="button" className="btn primary" onClick={() => sendToEditor(true)}>
          #{selectedPlayer?.number}만 컷 → 편집
        </button>
      </div>

      {status ? <p className="status-line">{status}</p> : null}

      <ul className="scout-log">
        {[...session.points].reverse().slice(0, 12).map((p) => (
          <li key={p.id}>
            S{p.setIndex + 1} · {p.winner === "home" ? session.homeName : session.awayName} · {p.termination}
            {p.playerNumber != null ? ` · #${p.playerNumber} ${p.playerName}` : ""} ·{" "}
            {p.videoTimeSec ?? "-"}s
          </li>
        ))}
      </ul>
    </div>
  );
}
