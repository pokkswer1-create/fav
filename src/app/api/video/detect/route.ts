import { NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createDetectableSampleVideo,
  detectHighlightCandidates,
} from "@/lib/scene-detect";
import { ensureWorkDirs, sweepTempFiles, UPLOAD_ROOT } from "@/lib/video";
import {
  assertDurationAllowedForAutoAnalyze,
  isSamplePath,
  MAX_UPLOAD_BYTES,
  probeMedia,
  removePath,
  saveUploadFile,
} from "@/lib/media-validate";
import {
  clientIp,
  enforceContentLength,
  logServerError,
  publicErrorMessage,
  publicErrorStatus,
  rateLimit,
  rateLimitResponse,
  requireWriteAccess,
  withHeavyJob,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let uploadPath: string | null = null;
  try {
    const denied = requireWriteAccess(request);
    if (denied) return denied;
    const tooBig = enforceContentLength(request, MAX_UPLOAD_BYTES + 1024 * 1024);
    if (tooBig) return tooBig;
    const limited = rateLimit(`detect:${clientIp(request)}`, 8, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    await ensureWorkDirs();
    await sweepTempFiles();
    const contentType = request.headers.get("content-type") ?? "";
    let file: FormDataEntryValue | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      file = form.get("video");
    }

    let sourcePath = "";
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      uploadPath = path.join(UPLOAD_ROOT, `${randomUUID()}-detect.mp4`);
      await saveUploadFile(file as File, uploadPath);
      sourcePath = uploadPath;
    } else {
      sourcePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
      await createDetectableSampleVideo(sourcePath);
    }

    const probe = await probeMedia(sourcePath);
    assertDurationAllowedForAutoAnalyze(probe.durationSec);

    const result = await withHeavyJob(() => detectHighlightCandidates(sourcePath));
    return NextResponse.json(result);
  } catch (error) {
    logServerError("detect", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "장면 감지에 실패했습니다.") },
      { status: publicErrorStatus(error) },
    );
  } finally {
    if (uploadPath && !isSamplePath(uploadPath)) await removePath(uploadPath);
  }
}
