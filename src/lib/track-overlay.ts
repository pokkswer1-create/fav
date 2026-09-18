import type { PlayerMark } from "./player-marks";
import { groupMarksByPlayer } from "./player-marks";

export interface TrackPin {
  id: string;
  playerNumber: number;
  playerName: string;
  xNorm: number;
  yNorm: number;
  timeSec: number;
  /** 0..1 visual strength. */
  opacity: number;
  mode: "snap" | "lerp" | "hold" | "static";
  /** CSS color for multi-player distinction. */
  color?: string;
}

/** Suggested clicks per player for a stable follow path. */
export const TRACK_CLICKS_TARGET = 6;

function hasPos(m: PlayerMark): m is PlayerMark & { xNorm: number; yNorm: number } {
  return typeof m.xNorm === "number" && typeof m.yNorm === "number";
}

function positionalMarks(marks: PlayerMark[], playerNumber?: number): Array<PlayerMark & { xNorm: number; yNorm: number }> {
  return marks
    .filter(hasPos)
    .filter((m) => (playerNumber == null ? true : m.playerNumber === playerNumber))
    .sort((a, b) => a.timeSec - b.timeSec);
}

/** Stable accent per jersey so multiple follow pins stay readable. */
export function trackColorForPlayer(playerNumber: number): string {
  const n = Math.max(0, Math.min(99, Math.round(playerNumber)));
  // Magenta family for FAV brand, spaced by jersey so 6–7 players differ.
  const hue = (320 + n * 37) % 360;
  return `hsl(${hue} 88% 58%)`;
}

function holdPin(
  m: PlayerMark & { xNorm: number; yNorm: number },
  t: number,
  mode: "snap" | "hold" = "hold",
): TrackPin {
  return {
    id: `follow-${m.playerNumber}-${m.id}`,
    playerNumber: m.playerNumber,
    playerName: m.playerName,
    xNorm: m.xNorm,
    yNorm: m.yNorm,
    timeSec: t,
    opacity: 1,
    mode,
    color: trackColorForPlayer(m.playerNumber),
  };
}

/**
 * Follow pin for one player.
 * From first positional mark through duration end: lerp between marks, then hold last.
 */
export function resolveFollowPin(
  marks: PlayerMark[],
  timeSec: number,
  opts?: {
    playerNumber?: number;
    durationSec?: number;
  },
): TrackPin | null {
  const t = Number.isFinite(timeSec) ? timeSec : 0;
  const duration =
    typeof opts?.durationSec === "number" && Number.isFinite(opts.durationSec) && opts.durationSec > 0
      ? opts.durationSec
      : Number.POSITIVE_INFINITY;

  let numbered = opts?.playerNumber;
  let list = positionalMarks(marks, numbered);

  if (!list.length && numbered == null) {
    const all = positionalMarks(marks);
    if (!all.length) return null;
    let best = all[0];
    let bestDist = Math.abs(all[0].timeSec - t);
    for (const m of all) {
      const d = Math.abs(m.timeSec - t);
      if (d < bestDist) {
        best = m;
        bestDist = d;
      }
    }
    numbered = best.playerNumber;
    list = positionalMarks(marks, numbered);
  }

  if (!list.length) return null;

  const first = list[0];
  const last = list[list.length - 1];

  if (t < first.timeSec) return null;
  if (t > duration) return null;

  if (list.length === 1) {
    return holdPin(first, t, "hold");
  }

  if (t >= last.timeSec) {
    return holdPin(last, t, "hold");
  }

  let i = 0;
  while (i < list.length - 1 && list[i + 1].timeSec < t) i += 1;
  const a = list[i];
  const b = list[i + 1];
  const span = Math.max(0.001, b.timeSec - a.timeSec);
  const u = Math.max(0, Math.min(1, (t - a.timeSec) / span));
  return {
    id: `follow-${a.playerNumber}-${a.id}-${b.id}`,
    playerNumber: a.playerNumber,
    playerName: a.playerName,
    xNorm: a.xNorm + (b.xNorm - a.xNorm) * u,
    yNorm: a.yNorm + (b.yNorm - a.yNorm) * u,
    timeSec: t,
    opacity: 1,
    mode: "lerp",
    color: trackColorForPlayer(a.playerNumber),
  };
}

/**
 * One follow pin per player that has positional marks — each path is independent.
 */
export function resolveAllFollowPins(
  marks: PlayerMark[],
  timeSec: number,
  opts?: { durationSec?: number },
): TrackPin[] {
  const byPlayer = groupMarksByPlayer(marks.filter(hasPos));
  const pins: TrackPin[] = [];
  for (const playerNumber of [...byPlayer.keys()].sort((a, b) => a - b)) {
    const pin = resolveFollowPin(marks, timeSec, {
      playerNumber,
      durationSec: opts?.durationSec,
    });
    if (pin) pins.push(pin);
  }
  return pins;
}

/** Static dots for every click pin, colored per player. */
export function listStaticTrackPins(marks: PlayerMark[]): TrackPin[] {
  return positionalMarks(marks).map((m) => ({
    id: m.id,
    playerNumber: m.playerNumber,
    playerName: m.playerName,
    xNorm: m.xNorm,
    yNorm: m.yNorm,
    timeSec: m.timeSec,
    opacity: 0.55,
    mode: "static" as const,
    color: trackColorForPlayer(m.playerNumber),
  }));
}

export interface PlayerTrackSummary {
  playerNumber: number;
  playerName: string;
  pinCount: number;
  ready: boolean;
}

/** Per-player positional pin counts (for 6–7 click guidance). */
export function summarizePlayerTracks(marks: PlayerMark[]): PlayerTrackSummary[] {
  const byPlayer = groupMarksByPlayer(marks.filter(hasPos));
  return [...byPlayer.entries()]
    .map(([playerNumber, list]) => ({
      playerNumber,
      playerName: list[0]?.playerName ?? "선수",
      pinCount: list.length,
      ready: list.length >= 1,
    }))
    .sort((a, b) => a.playerNumber - b.playerNumber);
}
