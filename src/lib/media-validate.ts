import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { SafeHttpError } from "./security";

export interface MediaProbe {
  durationSec: number;
  formatName: string;
  videoCodec: string | null;
  audioCodec: string | null;
}

const ALLOWED_VIDEO = new Set(["h264", "hevc", "av1", "vp9", "mpeg4"]);
const ALLOWED_AUDIO = new Set(["aac", "mp3", "opus", "vorbis", "pcm_s16le", "flac"]);
/** Full matches can run up to ~4 hours. */
export const MAX_DURATION_SEC = Number(process.env.FAV_MAX_VIDEO_DURATION || 14_400);
/** Auto silence-detect / OCR are not reliable on multi-hour court video. */
export const AUTO_ANALYZE_MAX_DURATION_SEC = Number(
  process.env.FAV_AUTO_ANALYZE_MAX_DURATION || 1_200,
);

export function formatDurationLabel(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  if (sec < 90) return `${Math.round(sec)}초`;
  if (sec < 3600) return `${Math.round(sec / 60)}분`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export function assertDurationAllowedForAutoAnalyze(durationSec: number): void {
  if (durationSec > AUTO_ANALYZE_MAX_DURATION_SEC) {
    throw new SafeHttpError(
      400,
      `자동 감지/OCR은 ${formatDurationLabel(AUTO_ANALYZE_MAX_DURATION_SEC)} 이하만 지원합니다. 긴 경기는 스카우트 스탬프나 번호 찍기를 사용하세요.`,
    );
  }
}

function runCapture(cmd: string, args: string[], timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new SafeHttpError(408, "미디어 검사 시간이 초과되었습니다."));
    }, timeoutMs);
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new SafeHttpError(400, "지원하지 않는 영상 형식입니다."));
    });
  });
}

export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const raw = await runCapture("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  const parsed = JSON.parse(raw) as {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string }>;
  };
  const durationSec = Number(parsed.format?.duration ?? 0);
  const formatName = String(parsed.format?.format_name ?? "");
  const videoCodec =
    parsed.streams?.find((s) => s.codec_type === "video")?.codec_name ?? null;
  const audioCodec =
    parsed.streams?.find((s) => s.codec_type === "audio")?.codec_name ?? null;
  return { durationSec, formatName, videoCodec, audioCodec };
}

export async function assertAllowedMedia(filePath: string): Promise<MediaProbe> {
  const probe = await probeMedia(filePath);
  if (!Number.isFinite(probe.durationSec) || probe.durationSec <= 0) {
    throw new SafeHttpError(400, "영상 길이를 확인할 수 없습니다.");
  }
  if (probe.durationSec > MAX_DURATION_SEC) {
    throw new SafeHttpError(400, `영상은 ${MAX_DURATION_SEC}초 이하만 지원합니다.`);
  }
  const formats = probe.formatName.split(",").map((s) => s.trim().toLowerCase());
  const formatOk = formats.some((f) =>
    ["mp4", "mov", "m4a", "ismv", "matroska", "webm", "mpeg"].includes(f),
  );
  if (!formatOk) {
    throw new SafeHttpError(400, "허용되지 않은 컨테이너 형식입니다.");
  }
  if (!probe.videoCodec || !ALLOWED_VIDEO.has(probe.videoCodec.toLowerCase())) {
    throw new SafeHttpError(400, "허용되지 않은 비디오 코덱입니다.");
  }
  if (probe.audioCodec && !ALLOWED_AUDIO.has(probe.audioCodec.toLowerCase())) {
    throw new SafeHttpError(400, "허용되지 않은 오디오 코덱입니다.");
  }
  return probe;
}

const MAGIC_MP4 = [
  // ....ftyp
  (buf: Buffer) => buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp",
];

export function looksLikeVideoContainer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (MAGIC_MP4.some((fn) => fn(buf))) return true;
  // EBML (webm/mkv)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
  return false;
}

/** Default ~12 GiB — enough for a compressed 4h match or a phone MOV set. */
export const MAX_UPLOAD_BYTES = Number(
  process.env.FAV_MAX_UPLOAD_BYTES || 12 * 1024 * 1024 * 1024,
);

export async function saveUploadBytes(
  bytes: Buffer,
  targetPath: string,
): Promise<MediaProbe> {
  if (bytes.byteLength === 0) {
    throw new SafeHttpError(400, "빈 영상 파일입니다.");
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new SafeHttpError(413, "영상 용량 한도를 초과했습니다.");
  }
  if (!looksLikeVideoContainer(bytes.subarray(0, 64))) {
    throw new SafeHttpError(400, "영상 컨테이너로 인식되지 않습니다.");
  }
  await fs.writeFile(targetPath, bytes);
  return assertAllowedMedia(targetPath);
}

/** Stream a browser/File upload to disk without buffering the whole file in RAM. */
export async function saveUploadFile(file: File, targetPath: string): Promise<MediaProbe> {
  if (!file.size) {
    throw new SafeHttpError(400, "빈 영상 파일입니다.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new SafeHttpError(413, "영상 용량 한도를 초과했습니다.");
  }
  const header = Buffer.from(await file.slice(0, 64).arrayBuffer());
  if (!looksLikeVideoContainer(header)) {
    throw new SafeHttpError(400, "영상 컨테이너로 인식되지 않습니다.");
  }
  const webStream = file.stream();
  const nodeReadable = Readable.fromWeb(
    webStream as unknown as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeReadable, createWriteStream(targetPath));
  return assertAllowedMedia(targetPath);
}

export async function removePath(target?: string | null): Promise<void> {
  if (!target) return;
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

export function fileStreamResponse(
  filePath: string,
  headers: Record<string, string>,
): Response {
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(webStream, { headers });
}

export function isSamplePath(filePath: string): boolean {
  return path.basename(filePath) === "sample-match.mp4";
}
