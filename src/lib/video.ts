import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { VideoClipMarker } from "./types";

export const UPLOAD_ROOT = path.join("/tmp", "fav-uploads");
export const RENDER_ROOT = path.join("/tmp", "fav-renders");

export async function ensureWorkDirs(): Promise<void> {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.mkdir(RENDER_ROOT, { recursive: true });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed (${code}): ${stderr.slice(-800)}`));
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
    throw new Error("유효한 클립이 없습니다. 시작/종료 시간을 확인하세요.");
  }
  if (cleaned.length > 20) {
    throw new Error("클립은 최대 20개까지 가능합니다.");
  }
  return cleaned;
}

export async function renderHighlightReel(
  sourcePath: string,
  clips: VideoClipMarker[],
): Promise<{ outputPath: string; clipCount: number }> {
  await ensureWorkDirs();
  const valid = validateClips(clips);
  const jobId = randomUUID();
  const workDir = path.join(RENDER_ROOT, jobId);
  await fs.mkdir(workDir, { recursive: true });

  const partPaths: string[] = [];
  for (let i = 0; i < valid.length; i += 1) {
    const clip = valid[i];
    const part = path.join(workDir, `part-${String(i).padStart(2, "0")}.mp4`);
    await run("ffmpeg", [
      "-y",
      "-ss",
      String(clip.startSec),
      "-to",
      String(clip.endSec),
      "-i",
      sourcePath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      part,
    ]);
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

  return { outputPath, clipCount: valid.length };
}

export async function createSampleMatchVideo(targetPath: string): Promise<void> {
  const { createDetectableSampleVideo } = await import("./scene-detect");
  await createDetectableSampleVideo(targetPath);
}
