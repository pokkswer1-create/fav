import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createSampleMatchVideo,
  ensureWorkDirs,
  renderHighlightReel,
  UPLOAD_ROOT,
} from "@/lib/video";
import type { VideoClipMarker } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureWorkDirs();
  const samplePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
  try {
    await fs.access(samplePath);
  } catch {
    await createSampleMatchVideo(samplePath);
  }
  const buffer = await fs.readFile(samplePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": 'inline; filename="fav-sample-match.mp4"',
    },
  });
}

export async function POST(request: Request) {
  try {
    await ensureWorkDirs();
    const form = await request.formData();
    const clipsRaw = String(form.get("clips") ?? "[]");
    const clips = JSON.parse(clipsRaw) as VideoClipMarker[];
    const file = form.get("video");

    let sourcePath = "";
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.byteLength === 0) {
        return NextResponse.json({ error: "빈 영상 파일입니다." }, { status: 400 });
      }
      if (bytes.byteLength > 200 * 1024 * 1024) {
        return NextResponse.json({ error: "영상은 200MB 이하만 지원합니다." }, { status: 400 });
      }
      sourcePath = path.join(UPLOAD_ROOT, `${randomUUID()}-source.mp4`);
      await fs.writeFile(sourcePath, bytes);
    } else {
      sourcePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
      try {
        await fs.access(sourcePath);
      } catch {
        await createSampleMatchVideo(sourcePath);
      }
    }

    const { outputPath, clipCount } = await renderHighlightReel(sourcePath, clips);
    const buffer = await fs.readFile(outputPath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="fav-highlights-${clipCount}.mp4"`,
        "X-Clip-Count": String(clipCount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "영상 편집 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
