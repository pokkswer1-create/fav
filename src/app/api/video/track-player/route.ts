import { NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { demoMatch } from "@/lib/demo-match";
import { trackPlayerInVideo } from "@/lib/player-track";
import { createDetectableSampleVideo } from "@/lib/scene-detect";
import type { PlayerStats } from "@/lib/types";
import { rosterSchema } from "@/lib/schemas";
import { ensureWorkDirs, sweepTempFiles, UPLOAD_ROOT } from "@/lib/video";
import {
  isSamplePath,
  MAX_UPLOAD_BYTES,
  removePath,
  saveUploadBytes,
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

function findPlayer(number: number, rosterJson?: string): PlayerStats {
  if (rosterJson) {
    try {
      const parsed = rosterSchema.safeParse(JSON.parse(rosterJson));
      if (parsed.success) {
        const hit = parsed.data.find((p) => p.number === number);
        if (hit) return hit;
      }
    } catch {
      // fall through
    }
  }
  const all = [...demoMatch.home.players, ...demoMatch.away.players];
  const found = all.find((p) => p.number === number);
  if (found) return found;
  return {
    id: `num-${number}`,
    name: `선수`,
    number,
    position: "U",
    attacks: 0,
    kills: 2,
    attackErrors: 0,
    blocks: 1,
    digs: 2,
    aces: 1,
    serveErrors: 0,
    receptions: 0,
    receptionErrors: 0,
    sets: 0,
    setErrors: 0,
  };
}

export async function POST(request: Request) {
  let uploadPath: string | null = null;
  try {
    const denied = requireWriteAccess(request);
    if (denied) return denied;
    const tooBig = enforceContentLength(request, MAX_UPLOAD_BYTES + 1024 * 1024);
    if (tooBig) return tooBig;
    const limited = rateLimit(`track:${clientIp(request)}`, 4, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    await ensureWorkDirs();
    await sweepTempFiles();
    const contentType = request.headers.get("content-type") ?? "";
    let jerseyNumber = 7;
    let rosterJson: string | undefined;
    let file: FormDataEntryValue | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      file = form.get("video");
      jerseyNumber = Number(form.get("number") ?? 7);
      rosterJson = String(form.get("roster") ?? "") || undefined;
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as { number?: number; roster?: PlayerStats[] };
      jerseyNumber = Number(body.number ?? 7);
      if (body.roster) {
        const parsed = rosterSchema.safeParse(body.roster);
        if (!parsed.success) {
          return NextResponse.json({ error: "로스터 형식이 올바르지 않습니다." }, { status: 400 });
        }
        rosterJson = JSON.stringify(parsed.data);
      }
    }

    if (!Number.isFinite(jerseyNumber) || jerseyNumber <= 0 || jerseyNumber >= 100) {
      return NextResponse.json({ error: "유효한 등번호가 필요합니다." }, { status: 400 });
    }

    let sourcePath = "";
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const bytes = Buffer.from(await file.arrayBuffer());
      uploadPath = path.join(UPLOAD_ROOT, `${randomUUID()}-track.mp4`);
      await saveUploadBytes(bytes, uploadPath);
      sourcePath = uploadPath;
    } else {
      sourcePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
      await createDetectableSampleVideo(sourcePath);
    }

    const player = findPlayer(jerseyNumber, rosterJson);
    const result = await withHeavyJob(() =>
      trackPlayerInVideo({
        videoPath: sourcePath,
        player,
        intervalSec: 0.45,
        // Uploaded match video: never invent clips from box-score.
        allowStatsFallback: !uploadPath,
      }),
    );

    if (!result.clips.length) {
      return NextResponse.json({ error: `#${jerseyNumber} 선수 구간을 찾지 못했습니다.` }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logServerError("track-player", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "선수 트래킹에 실패했습니다.") },
      { status: publicErrorStatus(error) },
    );
  } finally {
    if (uploadPath && !isSamplePath(uploadPath)) await removePath(uploadPath);
  }
}
