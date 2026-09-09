"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { demoMatch } from "@/lib/demo-match";
import { createDemoScoutSession } from "@/lib/demo-scout";
import {
  analyzeSideOut,
  appendCodedAction,
  buildMatchFromScout,
  clipsFromScoutPoints,
  computeSetScores,
  emptyPlayer,
  type PointTermination,
  type ScoutPoint,
  type ScoutSession,
  type TeamSide,
} from "@/lib/scout";
import { SkillCodePad, skillDraftSummary, useDefaultSkillDraft } from "./SkillCodePad";
import { buildDvwExport, downloadDvw } from "@/lib/dvw-export";
import { filterActionsToClips } from "@/lib/scout-filters";
import { alignClipsToDuration } from "@/lib/clip-align";
import {
  getCustomRosters,
  saveCustomRosters,
  saveScoutSession,
  saveStoredMatch,
  setEditorBridge,
  type CustomRosterPlayer,
  type CustomRosters,
} from "@/lib/storage";
import { analyzeMatch } from "@/lib/analysis";
import { sampleVideoUrl } from "@/lib/api-client";
import {
  captureClockFromPlayer,
  nextClockAfterSeek,
  shouldAutoFollowPlayback,
} from "@/lib/video-clock";
import type { PlayerStats, Position } from "@/lib/types";
import { WingLogo } from "./SiteHeader";

const TERMINATIONS: { value: PointTermination; label: string }[] = [
  { value: "kill", label: "킬" },
  { value: "ace", label: "에이스" },
  { value: "block", label: "블로킹" },
  { value: "opponent_error", label: "상대범실" },
  { value: "our_error", label: "우리범실" },
  { value: "other", label: "기타" },
];

const POSITIONS: Position[] = ["OH", "OPP", "MB", "S", "L", "U"];

function newId(): string {
  return `pt-${crypto.randomUUID().slice(0, 8)}`;
}

function toPlayers(list: CustomRosterPlayer[]): PlayerStats[] {
  return list.map((p) =>
    emptyPlayer({
      id: p.id,
      name: p.name,
      number: p.number,
      position: (POSITIONS.includes(p.position as Position) ? p.position : "U") as Position,
    }),
  );
}

function fromDemoRosters(): CustomRosters {
  return {
    homeName: demoMatch.home.name,
    awayName: demoMatch.away.name,
    home: demoMatch.home.players.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position,
    })),
    away: demoMatch.away.players.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function ScoutWorkbench() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [rosters, setRosters] = useState<CustomRosters>(() => getCustomRosters() ?? fromDemoRosters());
  const [session, setSession] = useState<ScoutSession>(() => ({
    id: crypto.randomUUID(),
    matchId: demoMatch.id,
    title: `${demoMatch.home.name} vs ${demoMatch.away.name}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    homeName: demoMatch.home.name,
    awayName: demoMatch.away.name,
    points: [],
    actions: [],
    homeRotation: 1,
    awayRotation: 1,
  }));
  const [setIndex, setSetIndex] = useState(0);
  const [serving, setServing] = useState<TeamSide>("home");
  const [videoClock, setVideoClock] = useState(0);
  const [followPlayback, setFollowPlayback] = useState(true);
  const [manualOverride, setManualOverride] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(20);
  const [skillDraft, setSkillDraft] = useDefaultSkillDraft();
  const [codeTeam, setCodeTeam] = useState<TeamSide>("home");
  const [showProCode, setShowProCode] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    () => (getCustomRosters() ?? fromDemoRosters()).home[0]?.id ?? "",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [showRosterEdit, setShowRosterEdit] = useState(false);

  const rosterHome = useMemo(() => toPlayers(rosters.home), [rosters.home]);
  const rosterAway = useMemo(() => toPlayers(rosters.away), [rosters.away]);
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

  useEffect(() => {
    setSession((prev) => ({
      ...prev,
      homeName: rosters.homeName,
      awayName: rosters.awayName,
      title: `${rosters.homeName} vs ${rosters.awayName}`,
    }));
  }, [rosters.homeName, rosters.awayName]);

  function touch(next: ScoutSession) {
    setSession({ ...next, updatedAt: new Date().toISOString() });
  }

  function syncClockFromVideo() {
    const el = videoRef.current;
    if (!el) return;
    if (!shouldAutoFollowPlayback({ followPlayback, manualOverride })) return;
    setVideoClock(captureClockFromPlayer(el));
  }

  function stampNow() {
    const el = videoRef.current;
    const t = el ? captureClockFromPlayer(el) : videoClock;
    setVideoClock(t);
    setManualOverride(false);
    setStatus(`영상 시계 ${t}s 동기화`);
    return t;
  }

  function addPoint(winner: TeamSide, termination: PointTermination) {
    const stamped =
      followPlayback && !manualOverride && videoRef.current
        ? captureClockFromPlayer(videoRef.current)
        : videoClock;
    if (followPlayback && !manualOverride) setVideoClock(stamped);

    const ourPlayer = selectedPlayer;

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
      videoTimeSec: Number(stamped.toFixed(1)),
      homeRotation: session.homeRotation ?? 1,
      awayRotation: session.awayRotation ?? 1,
    };

    const points = [...session.points, point];
    setServing(winner);
    touch({ ...session, points });
    setStatus(
      `S${setIndex + 1} ${(currentSet.home + (winner === "home" ? 1 : 0))}-${currentSet.away + (winner === "away" ? 1 : 0)} · ${termination} @ ${point.videoTimeSec}s`,
    );
  }

  function recordSkillAction() {
    const stamped =
      followPlayback && !manualOverride && videoRef.current
        ? captureClockFromPlayer(videoRef.current)
        : videoClock;
    if (followPlayback && !manualOverride) setVideoClock(stamped);

    const winner: TeamSide | undefined = skillDraft.pointEnding
      ? skillDraft.effect === "="
        ? codeTeam === "home"
          ? "away"
          : "home"
        : codeTeam
      : undefined;

    const next = appendCodedAction(
      session,
      {
        setIndex,
        team: codeTeam,
        skill: skillDraft.skill,
        effect: skillDraft.effect,
        playerNumber: selectedPlayer?.number,
        playerName: selectedPlayer?.name,
        endZone: skillDraft.endZone,
        combination: skillDraft.skill === "A" ? skillDraft.combination : undefined,
        videoTimeSec: Number(stamped.toFixed(1)),
        pointEnding: skillDraft.pointEnding,
      },
      winner
        ? {
            winner,
            serving,
          }
        : undefined,
    );
    setSession(next);
    if (winner) setServing(winner);
    setStatus(`코딩 ${skillDraftSummary(skillDraft)} @ ${stamped.toFixed(1)}s`);
  }

  function exportDvw() {
    const text = buildDvwExport({
      homeName: rosters.homeName,
      awayName: rosters.awayName,
      date: new Date().toISOString().slice(0, 10),
      actions: session.actions ?? [],
    });
    downloadDvw(`${rosters.homeName}-scout`, text);
    setStatus("DVW 내보내기 완료");
  }

  function sendFilteredToEditor(skillOnly?: boolean) {
    const duration = mediaDuration > 0 ? mediaDuration : 20;
    const clips = filterActionsToClips(session.actions ?? [], {
      skill: skillOnly ? skillDraft.skill : undefined,
      effect: skillOnly ? skillDraft.effect : undefined,
      playerNumber: skillOnly ? selectedPlayer?.number : undefined,
      durationSec: duration,
    });
    const aligned = alignClipsToDuration(
      clips.length ? clips : clipsFromScoutPoints(session.points, duration),
      duration,
    );
    if (!aligned.length) {
      setStatus("필터에 맞는 타임스탬프 액션이 없습니다.");
      return;
    }
    saveAll();
    setEditorBridge({
      version: 1,
      createdAt: new Date().toISOString(),
      source: "scout",
      clips: aligned,
      matchId: session.matchId,
      mediaDurationSec: duration,
      message: skillOnly
        ? `필터 ${skillDraft.skill}${skillDraft.effect} 클립`
        : "프로 코딩/스카우트 클립",
    });
    router.push("/editor?bridge=1");
  }
  function undo() {
    const actions = session.actions ?? [];
    if (actions.length) {
      const lastAct = actions[actions.length - 1];
      const nextActions = actions.slice(0, -1);
      const nextPoints =
        lastAct.pointEnding && session.points.length
          ? session.points.slice(0, -1)
          : session.points;
      const last = nextPoints[nextPoints.length - 1];
      touch({ ...session, actions: nextActions, points: nextPoints });
      if (last) setServing(last.winner);
      setStatus("마지막 코딩/포인트 취소");
      return;
    }
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
    setRosters(fromDemoRosters());
    setSetIndex(0);
    setServing("home");
    setStatus("데모 스카우트 로드 (영상 타임스탬프 포함)");
  }

  function saveRosterEdits(next: CustomRosters) {
    setRosters(next);
    saveCustomRosters(next);
    setStatus("커스텀 로스터 저장");
  }

  function addRosterPlayer(sideKey: "home" | "away") {
    const next = { ...rosters, [sideKey]: [...rosters[sideKey]] };
    next[sideKey].push({
      id: `${sideKey}-${crypto.randomUUID().slice(0, 6)}`,
      name: "신규",
      number: Math.max(0, ...next[sideKey].map((p) => p.number)) + 1,
      position: "OH",
    });
    saveRosterEdits(next);
  }

  function saveAll() {
    const match = buildMatchFromScout(
      { ...session, homeName: rosters.homeName, awayName: rosters.awayName },
      { home: rosterHome, away: rosterAway },
    );
    const analysis = analyzeMatch(match);
    saveScoutSession({ ...session, homeName: rosters.homeName, awayName: rosters.awayName });
    saveCustomRosters(rosters);
    saveStoredMatch({
      id: session.matchId,
      savedAt: new Date().toISOString(),
      match,
      analysis,
      notes: `scout:${session.id}`,
    });
    setStatus("경기·스카우트·로스터 저장 완료 (보관함)");
  }

  function sendToEditor(onlyPlayer?: boolean) {
    const duration = mediaDuration > 0 ? mediaDuration : 20;
    const raw = clipsFromScoutPoints(session.points, duration, {
      onlyPlayerNumber: onlyPlayer ? selectedPlayer?.number : undefined,
    });
    const clips = alignClipsToDuration(raw, duration);
    if (!clips.length) {
      setStatus("타임스탬프가 있는 포인트가 없습니다. 재생 중 득점 버튼을 누르거나 시계를 맞추세요.");
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
      mediaDurationSec: duration,
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
          영상 재생 시각이 시계에 자동 동기화됩니다. 득점 버튼을 누르면 그 시각이 컷 타임스탬프가 됩니다.
        </p>
      </section>

      <div className="scout-media-grid">
        <div className="scout-video-pane">
          <video
            ref={videoRef}
            src={sampleVideoUrl()}
            controls
            playsInline
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setMediaDuration(d);
            }}
            onTimeUpdate={syncClockFromVideo}
            onPlay={() => {
              setFollowPlayback(true);
              setManualOverride(false);
            }}
          />
          <div className="pane-actions">
            <button type="button" className="btn ghost" onClick={stampNow}>
              지금 시각 찍기
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                const next = nextClockAfterSeek(videoClock, -1);
                setVideoClock(next);
                if (videoRef.current) videoRef.current.currentTime = next;
              }}
            >
              -1s
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                const next = nextClockAfterSeek(videoClock, 1);
                setVideoClock(next);
                if (videoRef.current) videoRef.current.currentTime = next;
              }}
            >
              +1s
            </button>
            <label className="follow-toggle">
              <input
                type="checkbox"
                checked={followPlayback && !manualOverride}
                onChange={(e) => {
                  setFollowPlayback(e.target.checked);
                  setManualOverride(!e.target.checked);
                }}
              />
              재생 따라가기
            </label>
          </div>
        </div>

        <div>
          <div className="scout-scoreboard">
            <WingLogo size={40} />
            <div>
              <strong>
                {rosters.homeName} {currentSet.home} - {currentSet.away} {rosters.awayName}
              </strong>
              <p>
                SET {setIndex + 1} · 서브 {serving === "home" ? rosters.homeName : rosters.awayName} · P
                {session.homeRotation ?? 1}/P{session.awayRotation ?? 1} · 시계 {videoClock.toFixed(1)}s /{" "}
                {mediaDuration.toFixed(1)}s
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
                <option value="home">{rosters.homeName}</option>
                <option value="away">{rosters.awayName}</option>
              </select>
            </label>
            <label>
              선수
              <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
                <optgroup label={rosters.homeName}>
                  {rosterHome.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.number} {p.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={rosters.awayName}>
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
                onChange={(e) => {
                  setManualOverride(true);
                  setVideoClock(Number(e.target.value) || 0);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="pane-actions">
        <button type="button" className="btn ghost" onClick={() => setShowRosterEdit((v) => !v)}>
          {showRosterEdit ? "로스터 닫기" : "커스텀 로스터"}
        </button>
      </div>

      {showRosterEdit ? (
        <section className="roster-editor">
          <div className="roster-cols">
            {(["home", "away"] as const).map((sideKey) => (
              <div key={sideKey}>
                <label>
                  {sideKey === "home" ? "홈 팀명" : "어웨이 팀명"}
                  <input
                    value={sideKey === "home" ? rosters.homeName : rosters.awayName}
                    onChange={(e) =>
                      saveRosterEdits({
                        ...rosters,
                        [sideKey === "home" ? "homeName" : "awayName"]: e.target.value,
                      })
                    }
                  />
                </label>
                <ul className="roster-edit-list">
                  {rosters[sideKey].map((p, idx) => (
                    <li key={p.id}>
                      <input
                        aria-label="등번호"
                        type="number"
                        value={p.number}
                        onChange={(e) => {
                          const list = [...rosters[sideKey]];
                          list[idx] = { ...p, number: Number(e.target.value) || 0 };
                          saveRosterEdits({ ...rosters, [sideKey]: list });
                        }}
                      />
                      <input
                        aria-label="이름"
                        value={p.name}
                        onChange={(e) => {
                          const list = [...rosters[sideKey]];
                          list[idx] = { ...p, name: e.target.value };
                          saveRosterEdits({ ...rosters, [sideKey]: list });
                        }}
                      />
                      <select
                        value={p.position}
                        onChange={(e) => {
                          const list = [...rosters[sideKey]];
                          list[idx] = { ...p, position: e.target.value };
                          saveRosterEdits({ ...rosters, [sideKey]: list });
                        }}
                      >
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn ghost" onClick={() => addRosterPlayer(sideKey)}>
                  선수 추가
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="pane-actions">
        <button
          type="button"
          className={`btn ghost ${showProCode ? "is-active" : ""}`}
          onClick={() => setShowProCode((v) => !v)}
        >
          {showProCode ? "프로 코딩 닫기" : "프로 코딩 (DV/VS)"}
        </button>
        <label className="follow-toggle inline">
          코딩 팀
          <select value={codeTeam} onChange={(e) => setCodeTeam(e.target.value as TeamSide)}>
            <option value="home">{rosters.homeName}</option>
            <option value="away">{rosters.awayName}</option>
          </select>
        </label>
      </div>

      {showProCode ? (
        <div className="pro-code-block">
          <SkillCodePad
            value={skillDraft}
            onChange={setSkillDraft}
            rotation={(codeTeam === "home" ? session.homeRotation : session.awayRotation) ?? 1}
            onRotationChange={(r) =>
              touch(
                codeTeam === "home"
                  ? { ...session, homeRotation: r }
                  : { ...session, awayRotation: r },
              )
            }
          />
          <div className="pane-actions">
            <button type="button" className="btn primary" onClick={recordSkillAction}>
              코딩 기록 · {skillDraftSummary(skillDraft)}
            </button>
            <button type="button" className="btn ghost" onClick={() => sendFilteredToEditor(true)}>
              이 스킬/퀄리티만 컷
            </button>
            <button type="button" className="btn ghost" onClick={() => sendFilteredToEditor(false)}>
              전체 코딩 컷
            </button>
            <button type="button" className="btn ghost" onClick={exportDvw}>
              DVW 내보내기
            </button>
          </div>
          {(session.actions?.length ?? 0) > 0 ? (
            <ul className="scout-log code-log">
              {[...(session.actions ?? [])].reverse().slice(0, 10).map((a) => (
                <li key={a.id}>
                  {a.skill}
                  {a.effect}
                  {a.combination ? ` ${a.combination}` : ""}
                  {a.endZone ? ` Z${a.endZone}` : ""} · #
                  {a.playerNumber ?? "-"} · P{a.rotation ?? "-"} · {a.videoTimeSec ?? "-"}s
                  {a.pointEnding ? " · POINT" : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="scout-pad">
        <div className="scout-pad-col">
          <h3>{rosters.homeName} 득점 (빠른 입력)</h3>
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
          <h3>{rosters.awayName} 득점 (빠른 입력)</h3>
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
            S{p.setIndex + 1} · {p.winner === "home" ? rosters.homeName : rosters.awayName} · {p.termination}
            {p.playerNumber != null ? ` · #${p.playerNumber} ${p.playerName}` : ""}
            {p.homeRotation ? ` · P${p.homeRotation}` : ""} · {p.videoTimeSec ?? "-"}s
          </li>
        ))}
      </ul>
    </div>
  );
}
