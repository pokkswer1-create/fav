import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import {
  createSampleMatchVideo,
  ensureWorkDirs,
  renderHighlightReel,
  sweepTempFiles,
  UPLOAD_ROOT,
} from "@/lib/video";
import { clipsPayloadSchema } from "@/lib/schemas";
import {
  fileStreamResponse,
  isSamplePath,
  removePath,
  saveUploadFile,
  MAX_UPLOAD_BYTES,
} from "@/lib/media-validate";
import {
  clientIp,
  enforceContentLength,
  logServerError,
  publicErrorMessage,
  publicErrorStatus,
  rateLimit,
  rateLimitResponse,
  requireApiKey,
  requireWriteAccess,
  withHeavyJob,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const limited = rateLimit(`sample:${clientIp(request)}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  await ensureWorkDirs();
  await sweepTempFiles();
  const samplePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
  try {
    await fs.access(samplePath);
  } catch {
    await createSampleMatchVideo(samplePath);
  }
  return fileStreamResponse(samplePath, {
    "Content-Type": "video/mp4",
    "Content-Disposition": 'inline; filename="fav-sample-match.mp4"',
    "Cache-Control": "no-store",
  });
}

export async function POST(request: Request) {
  let uploadPath: string | null = null;
  let workDir: string | null = null;
  try {
    const denied = requireWriteAccess(request);
    if (denied) return denied;
    const tooBig = enforceContentLength(request, MAX_UPLOAD_BYTES + 1024 * 1024);
    if (tooBig) return tooBig;
    const limited = rateLimit(`highlights:${clientIp(request)}`, 8, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    await ensureWorkDirs();
    await sweepTempFiles();
    const form = await request.formData();
    const clipsParsed = clipsPayloadSchema.safeParse(JSON.parse(String(form.get("clips") ?? "[]")));
    if (!clipsParsed.success) {
      return NextResponse.json({ error: "클립 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const file = form.get("video");

    let sourcePath = "";
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      uploadPath = path.join(UPLOAD_ROOT, `${randomUUID()}-source.mp4`);
      await saveUploadFile(file as File, uploadPath);
      sourcePath = uploadPath;
    } else {
      sourcePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
      try {
        await fs.access(sourcePath);
      } catch {
        await createSampleMatchVideo(sourcePath);
      }
    }

    const result = await withHeavyJob(() => renderHighlightReel(sourcePath, clipsParsed.data));
    workDir = result.workDir;

    const nodeStream = createReadStream(result.outputPath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    // Cleanup after stream finishes
    nodeStream.on("close", () => {
      void removePath(workDir);
      if (uploadPath && !isSamplePath(uploadPath)) void removePath(uploadPath);
    });

    return new Response(webStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="fav-highlights-${result.clipCount}.mp4"`,
        "X-Clip-Count": String(result.clipCount),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("highlights", error);
    if (workDir) await removePath(workDir);
    if (uploadPath && !isSamplePath(uploadPath)) await removePath(uploadPath);
    return NextResponse.json(
      { error: publicErrorMessage(error, "영상 편집에 실패했습니다.") },
      { status: publicErrorStatus(error) },
    );
  }
}
