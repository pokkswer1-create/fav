import { NextResponse } from "next/server";
import { analyzeMatch } from "@/lib/analysis";
import { demoMatch } from "@/lib/demo-match";
import { matchInputSchema } from "@/lib/schemas";
import {
  clientIp,
  enforceContentLength,
  logServerError,
  publicErrorMessage,
  publicErrorStatus,
  rateLimit,
  rateLimitResponse,
  requireApiKey,
} from "@/lib/security";

const ANALYZE_MAX_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const limited = rateLimit(`analyze-get:${clientIp(request)}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const report = analyzeMatch(demoMatch);
  return NextResponse.json({ match: demoMatch, report });
}

export async function POST(request: Request) {
  try {
    const denied = requireApiKey(request);
    if (denied) return denied;
    const tooBig = enforceContentLength(request, ANALYZE_MAX_BYTES);
    if (tooBig) return tooBig;
    const limited = rateLimit(`analyze-post:${clientIp(request)}`, 30, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const json = await request.json();
    const parsed = matchInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "경기 데이터 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const report = analyzeMatch(parsed.data);
    return NextResponse.json({ match: parsed.data, report });
  } catch (error) {
    logServerError("analyze", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "분석에 실패했습니다.") },
      { status: publicErrorStatus(error) },
    );
  }
}
