import type { ClipKind, VideoClipMarker } from "./types";
import { alignClipsToDuration } from "./clip-align";

/** Manual jersey / player pin on the video timeline (no OCR). */
export interface PlayerMark {
  id: string;
  timeSec: number;
  playerNumber: number;
  playerName: string;
  playerId?: string;
  /** Normalized click position on the video frame (0..1), optional for future visual track. */
  xNorm?: number;
  yNorm?: number;
  note?: string;
}

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mark-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPlayerMark(input: {
  timeSec: number;
  playerNumber: number;
  playerName?: string;
  playerId?: string;
  xNorm?: number;
  yNorm?: number;
  note?: string;
}): PlayerMark {
  const timeSec = Number.isFinite(input.timeSec) ? Math.max(0, Number(input.timeSec.toFixed(1))) : 0;
  const playerNumber = Math.max(0, Math.min(99, Math.round(input.playerNumber)));
  return {
    id: newId(),
    timeSec,
    playerNumber,
    playerName: (input.playerName ?? `선수`).trim() || "선수",
    playerId: input.playerId,
    xNorm:
      typeof input.xNorm === "number" && Number.isFinite(input.xNorm)
        ? Math.max(0, Math.min(1, input.xNorm))
        : undefined,
    yNorm:
      typeof input.yNorm === "number" && Number.isFinite(input.yNorm)
        ? Math.max(0, Math.min(1, input.yNorm))
        : undefined,
    note: input.note?.trim() || undefined,
  };
}

export function groupMarksByPlayer(marks: PlayerMark[]): Map<number, PlayerMark[]> {
  const map = new Map<number, PlayerMark[]>();
  for (const mark of [...marks].sort((a, b) => a.timeSec - b.timeSec)) {
    const list = map.get(mark.playerNumber) ?? [];
    list.push(mark);
    map.set(mark.playerNumber, list);
  }
  return map;
}

/**
 * Turn manual player marks into highlight clips.
 * Nearby marks for the same player merge into one window.
 */
export function marksToClips(
  marks: PlayerMark[],
  durationSec: number,
  opts?: {
    padSec?: number;
    mergeGapSec?: number;
    kind?: ClipKind;
    onlyPlayerNumber?: number;
  },
): VideoClipMarker[] {
  const pad = opts?.padSec ?? 1.2;
  const mergeGap = opts?.mergeGapSec ?? 2.5;
  const kind = opts?.kind ?? "custom";
  const filtered =
    opts?.onlyPlayerNumber == null
      ? marks
      : marks.filter((m) => m.playerNumber === opts.onlyPlayerNumber);

  const byPlayer = groupMarksByPlayer(filtered);
  const raw: VideoClipMarker[] = [];

  for (const [playerNumber, list] of byPlayer) {
    if (!list.length) continue;
    const groups: Array<{ start: number; end: number; name: string; playerId?: string }> = [];
    let start = list[0].timeSec;
    let end = list[0].timeSec;
    let name = list[0].playerName;
    let playerId = list[0].playerId;

    for (let i = 1; i < list.length; i += 1) {
      const m = list[i];
      if (m.timeSec - end <= mergeGap) {
        end = m.timeSec;
        name = m.playerName || name;
        playerId = m.playerId ?? playerId;
      } else {
        groups.push({ start, end, name, playerId });
        start = m.timeSec;
        end = m.timeSec;
        name = m.playerName;
        playerId = m.playerId;
      }
    }
    groups.push({ start, end, name, playerId });

    groups.forEach((g, index) => {
      const startSec = Math.max(0, Number((g.start - pad).toFixed(1)));
      const endSec = Math.min(durationSec, Number((g.end + pad).toFixed(1)));
      if (endSec <= startSec) return;
      raw.push({
        id: newId(),
        startSec,
        endSec: Math.max(startSec + 1.2, endSec),
        kind,
        label: `#${playerNumber} ${g.name} 마크 #${index + 1}`,
        playerNumber,
        playerName: g.name,
        playerId: g.playerId,
      });
    });
  }

  return alignClipsToDuration(
    raw.sort((a, b) => a.startSec - b.startSec || (a.playerNumber ?? 0) - (b.playerNumber ?? 0)),
    durationSec,
  );
}

export function summarizeMarks(marks: PlayerMark[]): Array<{
  playerNumber: number;
  playerName: string;
  count: number;
}> {
  const byPlayer = groupMarksByPlayer(marks);
  return [...byPlayer.entries()].map(([playerNumber, list]) => ({
    playerNumber,
    playerName: list[0]?.playerName ?? "선수",
    count: list.length,
  }));
}
