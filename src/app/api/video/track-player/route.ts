import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { demoMatch } from "@/lib/demo-match";
import { trackPlayerInVideo } from "@/lib/player-track";
import { createDetectableSampleVideo } from "@/lib/scene-detect";
import type { PlayerStats } from "@/lib/types";
import { ensureWorkDirs, UPLOAD_ROOT } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function findPlayer(number: number, rosterJson?: string): PlayerStats {
  if (rosterJson) {
    try {
      const roster = JSON.parse(rosterJson) as PlayerStats[];
      const hit = roster.find((p) => p.number === number);
      if (hit) return hit;
    } catch {
      // fall through to demo roster
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
  try {
    await ensureWorkDirs();
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
      if (body.roster) rosterJson = JSON.stringify(body.roster);
    }

    if (!Number.isFinite(jerseyNumber) || jerseyNumber <= 0 || jerseyNumber >= 100) {
      return NextResponse.json({ error: "유효한 등번호가 필요합니다." }, { status: 400 });
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
      sourcePath = path.join(UPLOAD_ROOT, `${randomUUID()}-track.mp4`);
      await fs.writeFile(sourcePath, bytes);
    } else {
      sourcePath = path.join(UPLOAD_ROOT, "sample-match.mp4");
      await createDetectableSampleVideo(sourcePath);
    }

    const player = findPlayer(jerseyNumber, rosterJson);
    const result = await trackPlayerInVideo({
      videoPath: sourcePath,
      player,
      intervalSec: 0.45,
    });

    if (!result.clips.length) {
      return NextResponse.json(
        { error: `#${jerseyNumber} 선수 구간을 찾지 못했습니다.`, ...result },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "선수 트래킹 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
