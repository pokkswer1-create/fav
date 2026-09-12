import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { VideoClipMarker } from "./types";
import { removePath, probeMedia } from "./media-validate";
import { SafeHttpError, logServerError } from "./security";
import { alignClipsToDuration } from "./clip-align";
import {
  buildHighlightOverlayFilterComplex,
  buildTitleCardDrawtext,
  defaultOverlayAssetPaths,
  overlayOptionsForClip,
  resolveOverlayFont,
  type HighlightMatchOverlay,
} from "./highlight-overlay";

export const UPLOAD_ROOT = path.join("/tmp", "fav-uploads");
export const RENDER_ROOT = path.join("/tmp", "fav-renders");

const SPAWN_TIMEOUT_MS = Number(process.env.FAV_FFMPEG_TIMEOUT_MS || 600_000);

export async function ensureWorkDirs(): Promise<void> {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.mkdir(RENDER_ROOT, { recursive: true });
}

function run(cmd: string, args: string[], timeoutMs = SPAWN_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new SafeHttpError(408, "영상 처리 시간이 초과되었습니다."));
    }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        logServerError("ffmpeg", `${cmd} ${args.join(" ")} => ${code}: ${stderr.slice(-800)}`);
        reject(new SafeHttpError(400, "영상 처리에 실패했습니다."));
      }
    });
  });
}

export function validateClips(clips: VideoClipMarker[]): VideoClipMarker[] {
  const cleaned = clips
    .map((c) => ({
      ...c,
      startSec: Number(c.startSec),
      endSec: Number(c.endSec),
      label: String(c.label || c.kind).slice(0, 40),
    }))
    .filter((c) => Number.isFinite(c.startSec) && Number.isFinite(c.endSec))
    .filter((c) => c.endSec > c.startSec)
    .filter((c) => c.endSec - c.startSec <= 60)
    .sort((a, b) => a.startSec - b.startSec);

  if (cleaned.length === 0) {
    throw new SafeHttpError(400, "유효한 클립이 없습니다. 시작/종료 시간을 확인하세요.");
  }
  if (cleaned.length > 20) {
    throw new SafeHttpError(400, "클립은 최대 20개까지 가능합니다.");
  }
  return cleaned;
}

const DEFAULT_OVERLAY: HighlightMatchOverlay = {
  homeName: "FAV",
  awayName: "서울 윙스",
  includeTitleCard: true,
  titleSubtitle: "Total Analysis",
  showCourtLines: true,
  showLogo: true,
};

async function renderTitleCardPart(
  workDir: string,
  match: HighlightMatchOverlay,
): Promise<string | null> {
  if (match.includeTitleCard === false) return null;
  const font = resolveOverlayFont();
  const draw = buildTitleCardDrawtext({
    homeName: match.homeName,
    awayName: match.awayName,
    subtitle: match.titleSubtitle ?? "Total Analysis",
    fontFile: font,
  });
  const part = path.join(workDir, "part-title.mp4");
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x0B1220:s=1280x720:d=2.2",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf",
    draw,
    "-t",
    "2.2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    part,
  ]);
  return part;
}

async function encodeOverlayClip(
  sourcePath: string,
  clip: VideoClipMarker,
  partPath: string,
  match: HighlightMatchOverlay,
  assets: { logoPath: string; courtLinesPath: string },
): Promise<void> {
  const hasLogo = match.showLogo !== false && existsSync(assets.logoPath);
  const hasLines = match.showCourtLines !== false && existsSync(assets.courtLinesPath);
  const opts = overlayOptionsForClip(clip, {
    ...match,
    showLogo: hasLogo,
    showCourtLines: hasLines,
  });

  let filter = buildHighlightOverlayFilterComplex(opts);
  const args: string[] = [
    "-y",
    "-ss",
    String(clip.startSec),
    "-to",
    String(clip.endSec),
    "-i",
    sourcePath,
  ];

  if (hasLogo && hasLines) {
    args.push("-i", assets.logoPath, "-i", assets.courtLinesPath);
  } else if (hasLogo) {
    args.push("-i", assets.logoPath);
  } else if (hasLines) {
    args.push("-i", assets.courtLinesPath);
    filter = filter.replaceAll("[2:v]", "[1:v]");
  }

  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[vout]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    partPath,
  );

  await run("ffmpeg", args);
}

export async function renderHighlightReel(
  sourcePath: string,
  clips: VideoClipMarker[],
  overlay?: Partial<HighlightMatchOverlay> | null,
): Promise<{ outputPath: string; clipCount: number; workDir: string }> {
  await ensureWorkDirs();
  const probe = await probeMedia(sourcePath);
  const aligned = alignClipsToDuration(validateClips(clips), probe.durationSec);
  if (aligned.length === 0) {
    throw new SafeHttpError(400, "영상 길이에 맞는 유효 클립이 없습니다.");
  }
  const valid = aligned;
  const jobId = randomUUID();
  const workDir = path.join(RENDER_ROOT, jobId);
  await fs.mkdir(workDir, { recursive: true });
  const match: HighlightMatchOverlay = { ...DEFAULT_OVERLAY, ...overlay };
  const assets = defaultOverlayAssetPaths();

  try {
    const partPaths: string[] = [];
    const title = await renderTitleCardPart(workDir, match);
    if (title) partPaths.push(title);

    for (let i = 0; i < valid.length; i += 1) {
      const clip = valid[i];
      const part = path.join(workDir, `part-${String(i).padStart(2, "0")}.mp4`);
      await encodeOverlayClip(sourcePath, clip, part, match, assets);
      partPaths.push(part);
    }

    const listFile = path.join(workDir, "concat.txt");
    const listBody = partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(listFile, listBody, "utf8");

    const outputPath = path.join(workDir, "highlights.mp4");
    await run("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      outputPath,
    ]);

    return { outputPath, clipCount: valid.length, workDir };
  } catch (error) {
    await removePath(workDir);
    throw error;
  }
}

export async function createSampleMatchVideo(targetPath: string): Promise<void> {
  const { createDetectableSampleVideo } = await import("./scene-detect");
  const durationSec = Number(process.env.FAV_SAMPLE_DURATION_SEC || 20);
  await createDetectableSampleVideo(targetPath, {
    durationSec: Number.isFinite(durationSec) ? durationSec : 20,
  });
}

/** Remove old render/upload artifacts older than ttlMs (default 1h). */
export async function sweepTempFiles(ttlMs = 60 * 60 * 1000): Promise<void> {
  const roots = [UPLOAD_ROOT, RENDER_ROOT];
  const now = Date.now();
  for (const root of roots) {
    try {
      const entries = await fs.readdir(/*turbopackIgnore: true*/ root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "sample-match.mp4") continue;
        const full = `${root}/${entry.name}`;
        const stat = await fs.stat(/*turbopackIgnore: true*/ full);
        if (now - stat.mtimeMs > ttlMs) {
          await removePath(full);
        }
      }
    } catch {
      // ignore missing dirs
    }
  }
}
