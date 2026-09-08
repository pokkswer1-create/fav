import { NextResponse } from "next/server";
import { analyzeMatch } from "@/lib/analysis";
import { demoMatch } from "@/lib/demo-match";
import type { MatchInput } from "@/lib/types";

export async function GET() {
  const report = analyzeMatch(demoMatch);
  return NextResponse.json({ match: demoMatch, report });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MatchInput;
    if (!body?.home?.players?.length || !body?.away?.players?.length) {
      return NextResponse.json({ error: "홈/원정 선수 기록이 필요합니다." }, { status: 400 });
    }
    const report = analyzeMatch(body);
    return NextResponse.json({ match: body, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
