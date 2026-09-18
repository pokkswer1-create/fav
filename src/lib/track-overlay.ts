import type { PlayerMark } from "./player-marks";

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

function holdPin(
  m: PlayerMark & { xNorm: number; yNorm: number },
  t: number,
  mode: "snap" | "hold" = "hold",
): TrackPin {
  return {
    id: `follow-${m.id}`,
    playerNumber: m.playerNumber,
    playerName: m.playerName,
    xNorm: m.xNorm,
    yNorm: m.yNorm,
    timeSec: t,
    opacity: 1,
    mode,
  };
}

/**
 * Follow pin for playback.
 * Once a positional mark exists, the pin stays from the first mark through
 * the end of the video (lerp between marks, then hold the last position).
 */
export function resolveFollowPin(
  marks: PlayerMark[],
  timeSec: number,
  opts?: {
    playerNumber?: number;
    /** Video duration; when set, pin holds through the end. */
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

  // Before the first mark: no follow yet (user stamps, then we stick to the end).
  if (t < first.timeSec) return null;

  // Past the end of the media: hide.
  if (t > duration) return null;

  if (list.length === 1) {
    return holdPin(first, t, "hold");
  }

  // After last mark: hold last position until the end.
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
