import type { PlayerMark } from "./player-marks";

export interface TrackPin {
  id: string;
  playerNumber: number;
  playerName: string;
  xNorm: number;
  yNorm: number;
  timeSec: number;
  /** 0..1 visual strength (follow pin fades at edges). */
  opacity: number;
  mode: "snap" | "lerp" | "static";
}

function hasPos(m: PlayerMark): m is PlayerMark & { xNorm: number; yNorm: number } {
  return typeof m.xNorm === "number" && typeof m.yNorm === "number";
}

function positionalMarks(marks: PlayerMark[], playerNumber?: number): Array<PlayerMark & { xNorm: number; yNorm: number }> {
  return marks
    .filter(hasPos)
    .filter((m) => (playerNumber == null ? true : m.playerNumber === playerNumber))
    .sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * Interpolate (or snap) a follow pin for playback so the jersey marker
 * appears to track the player between manual click marks.
 */
export function resolveFollowPin(
  marks: PlayerMark[],
  timeSec: number,
  opts?: {
    playerNumber?: number;
    /** Max seconds from a lone mark before the pin disappears. */
    snapWindowSec?: number;
  },
): TrackPin | null {
  const t = Number.isFinite(timeSec) ? timeSec : 0;
  const snapWindow = opts?.snapWindowSec ?? 2.5;
  let numbered = opts?.playerNumber;
  let list = positionalMarks(marks, numbered);

  if (!list.length && numbered == null) {
    // Pick the player whose positional mark is nearest in time.
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

  if (list.length === 1) {
    const m = list[0];
    const dist = Math.abs(m.timeSec - t);
    if (dist > snapWindow) return null;
    const opacity = Math.max(0, 1 - dist / snapWindow);
    if (opacity <= 0.05) return null;
    return {
      id: `follow-${m.id}`,
      playerNumber: m.playerNumber,
      playerName: m.playerName,
      xNorm: m.xNorm,
      yNorm: m.yNorm,
      timeSec: t,
      opacity,
      mode: "snap",
    };
  }

  // Before first / after last: snap with fade
  if (t <= list[0].timeSec) {
    const m = list[0];
    const dist = m.timeSec - t;
    if (dist > snapWindow) return null;
    const opacity = Math.max(0.35, 1 - dist / snapWindow);
    return {
      id: `follow-${m.id}`,
      playerNumber: m.playerNumber,
      playerName: m.playerName,
      xNorm: m.xNorm,
      yNorm: m.yNorm,
      timeSec: t,
      opacity,
      mode: "snap",
    };
  }
  const last = list[list.length - 1];
  if (t >= last.timeSec) {
    const dist = t - last.timeSec;
    if (dist > snapWindow) return null;
    const opacity = Math.max(0.35, 1 - dist / snapWindow);
    return {
      id: `follow-${last.id}`,
      playerNumber: last.playerNumber,
      playerName: last.playerName,
      xNorm: last.xNorm,
      yNorm: last.yNorm,
      timeSec: t,
      opacity,
      mode: "snap",
    };
  }

  let i = 0;
  while (i < list.length - 1 && list[i + 1].timeSec < t) i += 1;
  const a = list[i];
  const b = list[i + 1];
  const span = Math.max(0.001, b.timeSec - a.timeSec);
  const u = Math.max(0, Math.min(1, (t - a.timeSec) / span));
  return {
    id: `follow-${a.id}-${b.id}`,
    playerNumber: a.playerNumber,
    playerName: a.playerName,
    xNorm: a.xNorm + (b.xNorm - a.xNorm) * u,
    yNorm: a.yNorm + (b.yNorm - a.yNorm) * u,
    timeSec: t,
    opacity: 1,
    mode: "lerp",
  };
}

/** Static dots for every click pin (always visible while marks exist). */
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
  }));
}
