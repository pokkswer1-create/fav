import { spawn } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ClipKind, PlayerStats, VideoClipMarker } from "./types";

export interface JerseyDetection {
  timeSec: number;
  number: number;
  confidence?: number;
}

export interface PlayerTrackResult {
  playerId?: string;
  playerName: string;
  playerNumber: number;
  durationSec: number;
  method: "ocr" | "stats-timeline" | "ocr+stats";
  detections: JerseyDetection[];
  clips: VideoClipMarker[];
}

function runCapture(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

export function clusterDetectionsToClips(
  detections: JerseyDetection[],
  opts: {
    playerNumber: number;
    playerName: string;
    playerId?: string;
    durationSec: number;
    mergeGapSec?: number;
    padSec?: number;
    kind?: ClipKind;
  },
): VideoClipMarker[] {
  const mergeGap = opts.mergeGapSec ?? 1.2;
  const pad = opts.padSec ?? 0.8;
  if (detections.length === 0) return [];

  const times = [...detections].map((d) => d.timeSec).sort((a, b) => a - b);
  const groups: Array<{ start: number; end: number }> = [];
  let start = times[0];
  let end = times[0];

  for (let i = 1; i < times.length; i += 1) {
    const t = times[i];
    if (t - end <= mergeGap) {
      end = t;
    } else {
      groups.push({ start, end });
      start = t;
      end = t;
    }
  }
  groups.push({ start, end });

  return groups.slice(0, 10).map((g, index) => {
    const startSec = Math.max(0, Number((g.start - pad).toFixed(1)));
    const endSec = Math.min(opts.durationSec, Number((g.end + pad + 0.6).toFixed(1)));
    return {
      id: randomUUID(),
      startSec,
      endSec: endSec > startSec + 0.8 ? endSec : Math.min(opts.durationSec, startSec + 1.5),
      kind: opts.kind ?? "custom",
      label: `#${opts.playerNumber} ${opts.playerName} 트래킹 #${index + 1}`,
      playerId: opts.playerId,
      playerName: opts.playerName,
      playerNumber: opts.playerNumber,
    };
  });
}

/** Build synthetic activity windows from box-score events when OCR finds little. */
export function statsTimelineClips(
  player: PlayerStats,
  durationSec: number,
): VideoClipMarker[] {
  const events: Array<{ kind: ClipKind; weight: number }> = [];
  for (let i = 0; i < player.kills; i += 1) events.push({ kind: "kill", weight: 3 });
  for (let i = 0; i < player.aces; i += 1) events.push({ kind: "ace", weight: 2.5 });
  for (let i = 0; i < player.blocks; i += 1) events.push({ kind: "block", weight: 2 });
  for (let i = 0; i < Math.min(player.digs, 4); i += 1) events.push({ kind: "dig", weight: 1 });

  if (events.length === 0) {
    events.push({ kind: "custom", weight: 1 }, { kind: "custom", weight: 1 });
  }

  const top = events.slice(0, 6);
  const clips: VideoClipMarker[] = [];
  top.forEach((ev, index) => {
    const ratio = (index + 0.5) / top.length;
    const center = durationSec * (0.12 + ratio * 0.76);
    const half = 1.1 + ev.weight * 0.15;
    const startSec = Math.max(0, Number((center - half).toFixed(1)));
    const endSec = Math.min(durationSec, Number((center + half).toFixed(1)));
    clips.push({
      id: randomUUID(),
      startSec,
      endSec,
      kind: ev.kind,
      label: `#${player.number} ${player.name} ${labelKind(ev.kind)} #${index + 1}`,
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
    });
  });
  return clips;
}

function labelKind(kind: ClipKind): string {
  const map: Record<ClipKind, string> = {
    kill: "킬",
    block: "블로킹",
    ace: "에이스",
    dig: "디그",
    rally: "랠리",
    error: "범실",
    custom: "플레이",
  };
  return map[kind];
}

export function mergePlayerClips(
  ocrClips: VideoClipMarker[],
  statsClips: VideoClipMarker[],
  durationSec: number,
): VideoClipMarker[] {
  const merged = [...ocrClips, ...statsClips]
    .filter((c) => c.endSec > c.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  const out: VideoClipMarker[] = [];
  for (const clip of merged) {
    const prev = out[out.length - 1];
    if (prev && clip.startSec < prev.endSec - 0.3) {
      // keep higher-priority OCR labels when overlapping
      if (prev.label.includes("트래킹") && !clip.label.includes("트래킹")) continue;
      prev.endSec = Math.min(durationSec, Math.max(prev.endSec, clip.endSec));
      continue;
    }
    out.push({ ...clip });
  }
  return out.slice(0, 12);
}

export async function runJerseyOcr(
  videoPath: string,
  jerseyNumber: number,
  intervalSec = 0.5,
): Promise<{ durationSec: number; detections: JerseyDetection[]; engine: string }> {
  const script = path.join(process.cwd(), "scripts", "track_jersey.py");
  const { stdout, stderr, code } = await runCapture("python3", [
    script,
    videoPath,
    String(jerseyNumber),
    "--interval",
    String(intervalSec),
  ]);
  if (code !== 0) {
    throw new Error(stderr || stdout || "jersey OCR failed");
  }
  const parsed = JSON.parse(stdout) as {
    error?: string;
    durationSec?: number;
    detections?: JerseyDetection[];
    engine?: string;
  };
  if (parsed.error) throw new Error(parsed.error);
  return {
    durationSec: parsed.durationSec ?? 0,
    detections: parsed.detections ?? [],
    engine: parsed.engine ?? "tesseract-ocr",
  };
}

export async function trackPlayerInVideo(opts: {
  videoPath: string;
  player: Pick<PlayerStats, "id" | "name" | "number" | "kills" | "aces" | "blocks" | "digs">;
  intervalSec?: number;
}): Promise<PlayerTrackResult> {
  const ocr = await runJerseyOcr(opts.videoPath, opts.player.number, opts.intervalSec ?? 0.5);
  const ocrClips = clusterDetectionsToClips(ocr.detections, {
    playerNumber: opts.player.number,
    playerName: opts.player.name,
    playerId: opts.player.id,
    durationSec: ocr.durationSec,
  });

  const statsClips = statsTimelineClips(opts.player as PlayerStats, ocr.durationSec);
  const useStats = ocrClips.length < 2;
  const clips = useStats
    ? mergePlayerClips(ocrClips, statsClips, ocr.durationSec)
    : ocrClips;

  return {
    playerId: opts.player.id,
    playerName: opts.player.name,
    playerNumber: opts.player.number,
    durationSec: ocr.durationSec,
    method: ocrClips.length && useStats ? "ocr+stats" : ocrClips.length ? "ocr" : "stats-timeline",
    detections: ocr.detections,
    clips,
  };
}
