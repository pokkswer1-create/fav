import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createDetectableSampleVideo,
  detectHighlightCandidates,
} from "@/lib/scene-detect";
import { ensureWorkDirs, UPLOAD_ROOT } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureWorkDirs();
    const contentType = request.headers.get("content-type") ?? "";
    let file: FormDataEntryValue | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      file = form.get("video");
    }

    let sourcePath = "";
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.byteLength === 0) {
        return NextResponse.json({ error: "빈 영상 파일입니다." }, { status: 400 });
      }
      if (bytes.byteLength > 200 * 1024 * 1024) {
        return NextResponse.json({ error: "영상은 200MB 이하만 지원합니다." }, { status: 400 });
      }
      sourcePath = path.join(UPLOAD_ROOT, `${randomUUID()}-detect.mp4`);
      await fs.writeFile(sourcePath, bytes);
    } else {
      sourcePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
      // Always refresh detectable sample so silence-gap demos stay accurate.
      await createDetectableSampleVideo(sourcePath);
    }

    const result = await detectHighlightCandidates(sourcePath);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "장면 감지 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
