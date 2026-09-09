import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  clientIp,
  getHeavyJobStats,
  publicErrorMessage,
  publicErrorStatus,
  rateLimit,
  rateLimitResponse,
  requireApiKey,
  requireWriteAccess,
} from "@/lib/security";
import { importLibraryBundle, type LibraryBundle } from "@/lib/library-bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIBRARY_ROOT = path.join("/tmp", "fav-library");
const BACKUP_FILE = path.join(LIBRARY_ROOT, "backup.json");

async function ensureLibraryDir(): Promise<void> {
  await fs.mkdir(LIBRARY_ROOT, { recursive: true });
}

export async function GET(request: Request) {
  try {
    const denied = requireApiKey(request);
    if (denied) return denied;
    const limited = rateLimit(`library-get:${clientIp(request)}`, 40, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    await ensureLibraryDir();
    try {
      const raw = await fs.readFile(BACKUP_FILE, "utf8");
      const bundle = importLibraryBundle(raw);
      return NextResponse.json({
        ok: true,
        bundle,
        heavy: getHeavyJobStats(),
      });
    } catch {
      return NextResponse.json({
        ok: true,
        bundle: {
          version: 1,
          exportedAt: new Date().toISOString(),
          matches: [],
          scouts: [],
        } satisfies LibraryBundle,
        heavy: getHeavyJobStats(),
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "보관함 조회 실패") },
      { status: publicErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const denied = requireWriteAccess(request);
    if (denied) return denied;
    const limited = rateLimit(`library-post:${clientIp(request)}`, 20, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const body = (await request.json()) as { bundle?: unknown };
    const bundle = importLibraryBundle(JSON.stringify(body.bundle ?? body));
    await ensureLibraryDir();
    await fs.writeFile(BACKUP_FILE, JSON.stringify(bundle, null, 2), "utf8");
    return NextResponse.json({
      ok: true,
      savedAt: new Date().toISOString(),
      matchCount: bundle.matches.length,
      scoutCount: bundle.scouts.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "보관함 저장 실패") },
      { status: publicErrorStatus(error) },
    );
  }
}
