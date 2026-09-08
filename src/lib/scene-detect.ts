import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { kindForPeakIntensity } from "./heatmap";
import type { ClipKind, VideoClipMarker } from "./types";
import { ensureWorkDirs } from "./video";

export interface AudioPeak {
  timeSec: number;
  intensity: number;
}

function runCapture(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
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
    child.on("close", (code) => {
      if (code === 0 || code === 1) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} failed (${code}): ${stderr.slice(-800)}`));
    });
  });
}

/** Parse ffmpeg silencedetect stderr into non-silent activity windows. */
export function parseSilenceGaps(
  silencedetectLog: string,
  durationSec: number,
): Array<{ start: number; end: number }> {
  const starts: number[] = [];
  const ends: number[] = [0];
  const startRe = /silence_start:\s*([0-9.]+)/g;
  const endRe = /silence_end:\s*([0-9.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(silencedetectLog))) starts.push(Number(m[1]));
  while ((m = endRe.exec(silencedetectLog))) ends.push(Number(m[1]));

  const windows: Array<{ start: number; end: number }> = [];
  // Activity from 0 until first silence_start, then between silence_end and next silence_start
  const events: Array<{ t: number; type: "s" | "e" }> = [
    ...starts.map((t) => ({ t, type: "s" as const })),
    ...starts.length === 0 && ends.length === 1
      ? []
      : ends.filter((t) => t > 0).map((t) => ({ t, type: "e" as const })),
  ].sort((a, b) => a.t - b.t);

  if (events.length === 0) {
    // No silence found → whole clip is active (or fully silent). Prefer whole duration as one window if short.
    if (durationSec > 0.5) windows.push({ start: 0, end: durationSec });
    return windows;
  }

  let cursor = 0;
  let inSilence = false;
  for (const ev of events) {
    if (ev.type === "s" && !inSilence) {
      if (ev.t - cursor >= 0.6) windows.push({ start: cursor, end: ev.t });
      inSilence = true;
    } else if (ev.type === "e" && inSilence) {
      cursor = ev.t;
      inSilence = false;
    }
  }
  if (!inSilence && durationSec - cursor >= 0.6) {
    windows.push({ start: cursor, end: durationSec });
  }
  return windows;
}

export function windowsToPeaks(
  windows: Array<{ start: number; end: number }>,
  durationSec: number,
): AudioPeak[] {
  const maxLen = Math.max(...windows.map((w) => w.end - w.start), 0.1);
  return windows.map((w, index) => {
    const mid = (w.start + w.end) / 2;
    const len = w.end - w.start;
    const intensity = Math.min(1, 0.42 + (len / maxLen) * 0.45 + (index === 0 ? 0.08 : 0));
    return { timeSec: mid, intensity };
  });
}

export function peaksToClips(peaks: AudioPeak[], durationSec: number): VideoClipMarker[] {
  const sorted = [...peaks].sort((a, b) => b.intensity - a.intensity).slice(0, 8);
  sorted.sort((a, b) => a.timeSec - b.timeSec);

  const clips: VideoClipMarker[] = [];
  for (const peak of sorted) {
    const kind = kindForPeakIntensity(peak.intensity);
    const pad = kind === "rally" ? 3.5 : 2.2;
    let start = Math.max(0, peak.timeSec - pad * 0.45);
    let end = Math.min(durationSec, peak.timeSec + pad * 0.55);
    if (end - start < 1.2) end = Math.min(durationSec, start + 1.2);
    // avoid heavy overlap with previous
    const prev = clips[clips.length - 1];
    if (prev && start < prev.endSec - 0.4) start = prev.endSec;
    if (end <= start + 0.8) continue;

    clips.push({
      id: randomUUID(),
      startSec: Number(start.toFixed(1)),
      endSec: Number(end.toFixed(1)),
      kind,
      label: labelForKind(kind, clips.length + 1),
    });
  }
  return clips;
}

function labelForKind(kind: ClipKind, index: number): string {
  const map: Record<ClipKind, string> = {
    kill: "자동감지 킬",
    block: "자동감지 블로킹",
    ace: "자동감지 에이스",
    dig: "자동감지 디그",
    rally: "자동감지 랠리",
    error: "자동감지 범실",
    custom: "자동감지 하이라이트",
  };
  return `${map[kind]} #${index}`;
}

async function probeDuration(sourcePath: string): Promise<number> {
  const { stdout } = await runCapture("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    sourcePath,
  ]);
  const n = Number(stdout.trim());
  return Number.isFinite(n) ? n : 0;
}

export async function detectHighlightCandidates(sourcePath: string): Promise<{
  durationSec: number;
  peaks: AudioPeak[];
  clips: VideoClipMarker[];
  method: "silence-gaps" | "fallback-grid";
}> {
  await ensureWorkDirs();
  const durationSec = await probeDuration(sourcePath);
  const { stderr } = await runCapture("ffmpeg", [
    "-i",
    sourcePath,
    "-af",
    "silencedetect=noise=-35dB:d=0.35",
    "-f",
    "null",
    "-",
  ]);

  const windows = parseSilenceGaps(stderr, durationSec);
  let peaks = windowsToPeaks(windows, durationSec);
  let method: "silence-gaps" | "fallback-grid" = "silence-gaps";

  // Continuous tone / no useful gaps → place synthetic peaks for demo usability
  if (peaks.length === 0 || (peaks.length === 1 && peaks[0].intensity < 0.5 && durationSec > 8)) {
    method = "fallback-grid";
    const anchors = [0.12, 0.38, 0.62, 0.85].map((r) => r * durationSec);
    peaks = anchors.map((t, i) => ({
      timeSec: t,
      intensity: 0.9 - i * 0.12,
    }));
  }

  return {
    durationSec,
    peaks,
    clips: peaksToClips(peaks, durationSec),
    method,
  };
}

/** Build a sample match video with quiet gaps + loud spikes + jersey number overlays. */
export async function createDetectableSampleVideo(targetPath: string): Promise<void> {
  await ensureWorkDirs();
  const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0x0B1F17:s=1280x720:d=20",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=660:duration=20",
        "-filter_complex",
        [
          "[0:v]drawbox=x=80:y=300:w=1120:h=8:color=0xFF2D95:t=fill",
          "drawbox=x=520:y=220:w=240:h=280:color=0x1a1a1a@0.9:t=fill",
          `drawtext=fontfile=${font}:text='7':fontsize=140:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-20:enable='between(t,1.2,4.2)'`,
          `drawtext=fontfile=${font}:text='10':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-20:enable='between(t,6.8,11.0)'`,
          `drawtext=fontfile=${font}:text='4':fontsize=140:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-20:enable='between(t,13.5,17.5)'[v]`,
        ].join(",") +
          ";[1:a]volume=enable='between(t,0,1.2)+between(t,4.2,6.8)+between(t,11.0,13.5)+between(t,17.5,20)':volume=0.001,volume=enable='between(t,1.2,4.2)+between(t,6.8,11.0)+between(t,13.5,17.5)':volume=1[a]",
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-shortest",
        "-movflags",
        "+faststart",
        targetPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sample detect video failed: ${stderr.slice(-600)}`));
    });
  });
}
