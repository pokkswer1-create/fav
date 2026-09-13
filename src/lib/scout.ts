import type { ClipKind, MatchInput, PlayerStats, TeamInput, VideoClipMarker } from "./types";
import type { CodedAction, CourtZone, RotationId, VolleyEffect, VolleySkill } from "./volley-codes";
import { effectToTermination, nextRotation } from "./volley-codes";

export type PointTermination =
  | "kill"
  | "ace"
  | "block"
  | "opponent_error"
  | "our_error"
  | "other";

export type TeamSide = "home" | "away";

export interface ScoutPoint {
  id: string;
  setIndex: number; // 0-based
  pointIndex: number;
  serving: TeamSide;
  winner: TeamSide;
  termination: PointTermination;
  playerId?: string;
  playerNumber?: number;
  playerName?: string;
  /** Absolute video timestamp (seconds) when the point ended — ground truth for clips */
  videoTimeSec?: number;
  note?: string;
  /** DataVolley-style enrichment */
  homeRotation?: RotationId;
  awayRotation?: RotationId;
  endSkill?: VolleySkill;
  endEffect?: VolleyEffect;
  endZone?: CourtZone;
  combination?: string;
}

export interface ScoutSession {
  id: string;
  matchId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  homeName: string;
  awayName: string;
  points: ScoutPoint[];
  /** Full skill coding stream (VolleyStation / DataVolley style) */
  actions?: CodedAction[];
  homeRotation?: RotationId;
  awayRotation?: RotationId;
}

export interface SideOutStats {
  homeServePoints: number;
  homeServeWon: number;
  awayServePoints: number;
  awayServeWon: number;
  homeSideOutRate: number;
  awaySideOutRate: number;
  longestHomeRun: number;
  longestAwayRun: number;
}

export interface SetScoreline {
  setIndex: number;
  home: number;
  away: number;
  winner: TeamSide | "none";
}

function safeDiv(n: number, d: number): number {
  return d <= 0 ? 0 : n / d;
}

export function emptyPlayer(partial: Partial<PlayerStats> & Pick<PlayerStats, "id" | "name" | "number" | "position">): PlayerStats {
  return {
    attacks: 0,
    kills: 0,
    attackErrors: 0,
    blocks: 0,
    digs: 0,
    aces: 0,
    serveErrors: 0,
    receptions: 0,
    receptionErrors: 0,
    sets: 0,
    setErrors: 0,
    ...partial,
  };
}

export function computeSetScores(points: ScoutPoint[]): SetScoreline[] {
  const bySet = new Map<number, { home: number; away: number }>();
  for (const p of points) {
    const cur = bySet.get(p.setIndex) ?? { home: 0, away: 0 };
    if (p.winner === "home") cur.home += 1;
    else cur.away += 1;
    bySet.set(p.setIndex, cur);
  }
  return [...bySet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([setIndex, s]) => ({
      setIndex,
      home: s.home,
      away: s.away,
      winner: s.home === s.away ? "none" : s.home > s.away ? "home" : "away",
    }));
}

export function analyzeSideOut(points: ScoutPoint[]): SideOutStats {
  let homeServePoints = 0;
  let homeServeWon = 0;
  let awayServePoints = 0;
  let awayServeWon = 0;
  let longestHomeRun = 0;
  let longestAwayRun = 0;
  let runHome = 0;
  let runAway = 0;

  for (const p of points) {
    if (p.serving === "home") {
      homeServePoints += 1;
      if (p.winner === "home") homeServeWon += 1;
    } else {
      awayServePoints += 1;
      if (p.winner === "away") awayServeWon += 1;
    }

    if (p.winner === "home") {
      runHome += 1;
      runAway = 0;
      longestHomeRun = Math.max(longestHomeRun, runHome);
    } else {
      runAway += 1;
      runHome = 0;
      longestAwayRun = Math.max(longestAwayRun, runAway);
    }
  }

  return {
    homeServePoints,
    homeServeWon,
    awayServePoints,
    awayServeWon,
    homeSideOutRate: safeDiv(
      points.filter((p) => p.serving === "away" && p.winner === "home").length,
      points.filter((p) => p.serving === "away").length,
    ),
    awaySideOutRate: safeDiv(
      points.filter((p) => p.serving === "home" && p.winner === "away").length,
      points.filter((p) => p.serving === "home").length,
    ),
    longestHomeRun,
    longestAwayRun,
  };
}

/** Apply point terminations onto player box scores (deterministic). */
export function applyPointToPlayerStats(
  players: PlayerStats[],
  point: ScoutPoint,
  side: TeamSide,
  ourSide: TeamSide,
): PlayerStats[] {
  if (!point.playerId && point.playerNumber == null) return players;
  return players.map((p) => {
    const match =
      (point.playerId && p.id === point.playerId) ||
      (point.playerNumber != null && p.number === point.playerNumber);
    if (!match) return p;
    if (side !== ourSide) return p;

    const next = { ...p };
    if (point.winner === ourSide) {
      if (point.termination === "kill") {
        next.attacks += 1;
        next.kills += 1;
      } else if (point.termination === "ace") {
        next.aces += 1;
      } else if (point.termination === "block") {
        next.blocks += 1;
      }
    } else if (point.termination === "our_error") {
      next.attackErrors += 1;
      next.attacks += 1;
    }
    return next;
  });
}

export function buildMatchFromScout(
  session: ScoutSession,
  roster: { home: PlayerStats[]; away: PlayerStats[] },
): MatchInput {
  let homePlayers = roster.home.map((p) => ({ ...p }));
  let awayPlayers = roster.away.map((p) => ({ ...p }));

  for (const point of session.points) {
    homePlayers = applyPointToPlayerStats(homePlayers, point, "home", "home");
    awayPlayers = applyPointToPlayerStats(awayPlayers, point, "away", "away");
  }

  const sets = computeSetScores(session.points);
  const home: TeamInput = {
    name: session.homeName,
    shortName: session.homeName.slice(0, 6) || "HOME",
    isFav: true,
    players: homePlayers,
    setScores: sets.map((s) => s.home),
  };
  const away: TeamInput = {
    name: session.awayName,
    shortName: session.awayName.slice(0, 6) || "AWAY",
    players: awayPlayers,
    setScores: sets.map((s) => s.away),
  };

  return {
    id: session.matchId || session.id,
    title: session.title,
    date: session.createdAt.slice(0, 10),
    venue: "스카우트 입력",
    home,
    away,
  };
}

export function terminationToClipKind(t: PointTermination): ClipKind {
  if (t === "kill") return "kill";
  if (t === "ace") return "ace";
  if (t === "block") return "block";
  if (t === "our_error" || t === "opponent_error") return "error";
  return "rally";
}

/**
 * Build aligned clips from scout points that have video timestamps.
 * This is the most reliable cutting source — no OCR guesswork.
 */
export function clipsFromScoutPoints(
  points: ScoutPoint[],
  durationSec: number,
  opts?: { padSec?: number; onlyPlayerNumber?: number },
): VideoClipMarker[] {
  const pad = opts?.padSec ?? 1.2;
  const stamped = points
    .filter((p) => typeof p.videoTimeSec === "number" && Number.isFinite(p.videoTimeSec))
    .sort((a, b) => {
      if (a.setIndex !== b.setIndex) return a.setIndex - b.setIndex;
      if (a.pointIndex !== b.pointIndex) return a.pointIndex - b.pointIndex;
      return (a.videoTimeSec ?? 0) - (b.videoTimeSec ?? 0);
    });

  const scoreAfter = new Map<string, { home: number; away: number }>();
  const scoreBySet = new Map<number, { home: number; away: number }>();
  for (const p of stamped) {
    const score = scoreBySet.get(p.setIndex) ?? { home: 0, away: 0 };
    if (p.winner === "home") score.home += 1;
    else score.away += 1;
    scoreBySet.set(p.setIndex, { ...score });
    scoreAfter.set(p.id, { ...score });
  }

  const clips: VideoClipMarker[] = [];
  for (const p of stamped) {
    if (
      opts?.onlyPlayerNumber != null &&
      p.playerNumber !== opts.onlyPlayerNumber
    ) {
      continue;
    }
    const score = scoreAfter.get(p.id) ?? { home: 0, away: 0 };
    const end = Math.min(durationSec, Number((p.videoTimeSec! + 0.4).toFixed(1)));
    const start = Math.max(0, Number((p.videoTimeSec! - pad).toFixed(1)));
    if (end <= start) continue;
    clips.push({
      id: `scout-${p.id}`,
      startSec: start,
      endSec: Math.min(durationSec, Math.max(start + 1.2, end)),
      kind: terminationToClipKind(p.termination),
      label: `#${p.playerNumber ?? "-"} ${p.playerName ?? "포인트"} ${p.termination}`,
      playerId: p.playerId,
      playerName: p.playerName,
      playerNumber: p.playerNumber,
      skill: p.endSkill,
      effect: p.endEffect,
      combination: p.combination,
      homeScore: score.home,
      awayScore: score.away,
      setIndex: p.setIndex,
      serveTeam: p.serving,
    });
  }
  return clips;
}


/** Estimate a provisional media length from scout stamps (do not hardcode 20s). */
export function estimateMediaDurationFromScout(
  session: Pick<ScoutSession, "points" | "actions">,
  fallbackSec = 14_400,
): number {
  const times: number[] = [];
  for (const p of session.points ?? []) {
    if (typeof p.videoTimeSec === "number" && Number.isFinite(p.videoTimeSec)) {
      times.push(p.videoTimeSec);
    }
  }
  for (const a of session.actions ?? []) {
    if (typeof a.videoTimeSec === "number" && Number.isFinite(a.videoTimeSec)) {
      times.push(a.videoTimeSec);
    }
  }
  if (!times.length) return fallbackSec;
  return Math.max(...times) + 30;
}

export function createScoutPoint(
  partial: Omit<ScoutPoint, "id" | "pointIndex"> & { pointIndex?: number },
): ScoutPoint {
  return {
    id: `pt-${Math.random().toString(36).slice(2, 10)}`,
    pointIndex: partial.pointIndex ?? 0,
    ...partial,
  };
}

/** Append a coded action; if point-ending, also emit a ScoutPoint and update rotations. */
export function appendCodedAction(
  session: ScoutSession,
  action: Omit<CodedAction, "id" | "rallyIndex"> & { id?: string },
  opts?: { winner?: TeamSide; serving?: TeamSide },
): ScoutSession {
  const actions = [...(session.actions ?? [])];
  const rallyIndex = actions.filter((a) => a.setIndex === action.setIndex).length;
  let homeRotation = session.homeRotation ?? 1;
  let awayRotation = session.awayRotation ?? 1;
  const full: CodedAction = {
    ...action,
    id: action.id ?? `act-${cryptoRandom()}`,
    rallyIndex,
    rotation:
      action.rotation ??
      (action.team === "home" ? homeRotation : awayRotation),
  };
  actions.push(full);

  let points = session.points;
  if (full.pointEnding && opts?.winner) {
    const servingResolved: TeamSide =
      opts.serving ?? (full.skill === "S" ? full.team : "home");
    const winner = opts.winner;
    const termination = effectToTermination(full.skill, full.effect, winner === full.team);
    const point: ScoutPoint = {
      id: `pt-${full.id}`,
      setIndex: full.setIndex,
      pointIndex: points.filter((p) => p.setIndex === full.setIndex).length,
      serving: servingResolved,
      winner,
      termination,
      playerNumber: full.playerNumber,
      playerName: full.playerName,
      videoTimeSec: full.videoTimeSec,
      homeRotation,
      awayRotation,
      endSkill: full.skill,
      endEffect: full.effect,
      endZone: full.endZone,
      combination: full.combination,
    };
    points = [...points, point];
    if (winner !== servingResolved) {
      if (winner === "home") homeRotation = nextRotation(homeRotation, false);
      else awayRotation = nextRotation(awayRotation, false);
    }
  }

  return {
    ...session,
    actions,
    points,
    homeRotation,
    awayRotation,
    updatedAt: new Date().toISOString(),
  };
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 10);
}

export { effectToTermination, nextRotation };

