import type { VideoClipMarker } from "./types";

/**
 * Clamp and sanitize clips so they never exceed media duration or overlap badly.
 * Misaligned cuts are useless — this is the hard guarantee layer.
 */
export function alignClipsToDuration(
  clips: VideoClipMarker[],
  durationSec: number,
  opts?: { minLen?: number; maxLen?: number; maxClips?: number },
): VideoClipMarker[] {
  const minLen = opts?.minLen ?? 0.8;
  const maxLen = opts?.maxLen ?? 60;
  const maxClips = opts?.maxClips ?? 20;
  const dur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  if (dur <= 0) return [];

  const cleaned = clips
    .map((c) => {
      let start = Number(c.startSec);
      let end = Number(c.endSec);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      start = Math.max(0, Math.min(start, dur));
      end = Math.max(0, Math.min(end, dur));
      if (end < start) [start, end] = [end, start];
      if (end - start < minLen) {
        end = Math.min(dur, start + minLen);
        if (end - start < minLen) {
          start = Math.max(0, end - minLen);
        }
      }
      if (end - start > maxLen) end = start + maxLen;
      if (end <= start || end - start < minLen * 0.5) return null;
      return {
        ...c,
        startSec: Number(start.toFixed(2)),
        endSec: Number(end.toFixed(2)),
        label: String(c.label || c.kind).slice(0, 60),
      };
    })
    .filter((c): c is VideoClipMarker => Boolean(c))
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);

  // Resolve overlaps: keep earlier clip, trim the next
  const out: VideoClipMarker[] = [];
  for (const clip of cleaned) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(clip);
      continue;
    }
    if (clip.startSec < prev.endSec) {
      const trimmedStart = prev.endSec;
      if (clip.endSec - trimmedStart >= minLen) {
        out.push({ ...clip, startSec: Number(trimmedStart.toFixed(2)) });
      }
      continue;
    }
    out.push(clip);
  }

  return out.slice(0, maxClips);
}

export function assertClipsWithinDuration(
  clips: VideoClipMarker[],
  durationSec: number,
): { ok: true } | { ok: false; reason: string } {
  for (const c of clips) {
    if (c.startSec < 0 || c.endSec > durationSec + 0.001) {
      return { ok: false, reason: `out of range ${c.startSec}-${c.endSec} / ${durationSec}` };
    }
    if (c.endSec <= c.startSec) {
      return { ok: false, reason: `invalid span ${c.label}` };
    }
  }
  return { ok: true };
}

export function totalClipDuration(clips: VideoClipMarker[]): number {
  return clips.reduce((s, c) => s + Math.max(0, c.endSec - c.startSec), 0);
}
