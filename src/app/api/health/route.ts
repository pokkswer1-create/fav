import { NextResponse } from "next/server";
import { getHeavyJobStats, getExpectedApiKey } from "@/lib/security";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean | string | number> = {
    ok: true,
    apiKeyConfigured: Boolean(getExpectedApiKey()),
    heavy: 0,
  };
  try {
    const heavy = getHeavyJobStats();
    checks.heavy = heavy.active;
    checks.heavyMax = heavy.max;
  } catch {
    checks.heavy = "unknown";
  }

  try {
    await fs.access("/usr/bin/ffmpeg");
    checks.ffmpeg = true;
  } catch {
    checks.ffmpeg = false;
    checks.ok = false;
  }

  try {
    await fs.access("/usr/bin/ffprobe");
    checks.ffprobe = true;
  } catch {
    checks.ffprobe = false;
    checks.ok = false;
  }

  try {
    await fs.mkdir(path.join("/tmp", "fav-uploads"), { recursive: true });
    checks.tmpWritable = true;
  } catch {
    checks.tmpWritable = false;
    checks.ok = false;
  }

  return NextResponse.json(checks, { status: checks.ok ? 200 : 503 });
}
