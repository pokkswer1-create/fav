import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { parseDvwText, dvwToScoutSession } from "@/lib/dvw-import";
import { UPLOAD_ROOT, ensureWorkDirs } from "@/lib/video";
import { removePath, MAX_UPLOAD_BYTES } from "@/lib/media-validate";
import {
  clientIp,
  enforceContentLength,
  logServerError,
  publicErrorMessage,
  publicErrorStatus,
  rateLimit,
  rateLimitResponse,
  requireWriteAccess,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runParseDvwPy(filePath: string): Promise<unknown | null> {
  const script = path.join(process.cwd(), "scripts", "parse_dvw.py");
  return new Promise((resolve) => {
    const child = spawn("python3", [script, filePath], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(null);
    }, 30_000);
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(null);
      }
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export async function POST(request: Request) {
  let uploadPath: string | null = null;
  try {
    const denied = requireWriteAccess(request);
    if (denied) return denied;
    const tooBig = enforceContentLength(request, Math.min(MAX_UPLOAD_BYTES, 8 * 1024 * 1024));
    if (tooBig) return tooBig;
    const limited = rateLimit(`dvw:${clientIp(request)}`, 20, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    await ensureWorkDirs();
    const form = await request.formData();
    const file = form.get("dvw");
    const textField = form.get("text");

    let text = "";
    if (typeof textField === "string" && textField.trim()) {
      text = textField;
    } else if (file && typeof file !== "string" && "arrayBuffer" in file) {
      uploadPath = path.join(UPLOAD_ROOT, `${randomUUID()}.dvw`);
      const buf = Buffer.from(await (file as File).arrayBuffer());
      await fs.writeFile(uploadPath, buf);
      text = buf.toString("utf8");
    } else {
      return NextResponse.json({ error: "DVW 파일 또는 text가 필요합니다." }, { status: 400 });
    }

    const imported = parseDvwText(text);
    const py = uploadPath ? await runParseDvwPy(uploadPath) : null;
    const session = dvwToScoutSession(imported);

    return NextResponse.json({
      ok: true,
      session,
      import: {
        engine: imported.engine,
        homeName: imported.homeName,
        awayName: imported.awayName,
        actionCount: imported.actions.length,
        pointCount: imported.points.length,
        notes: imported.notes,
      },
      pydatavolley: py,
    });
  } catch (error) {
    logServerError("dvw-import", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "DVW import 실패") },
      { status: publicErrorStatus(error) },
    );
  } finally {
    if (uploadPath) await removePath(uploadPath);
  }
}
