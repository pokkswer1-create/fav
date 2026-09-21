import { NextResponse } from "next/server";
import {
  getFivbMatchStats,
  listFivbMatches,
  listFivbTournaments,
} from "@/lib/fivb-vis";
import {
  clientIp,
  logServerError,
  publicErrorMessage,
  publicErrorStatus,
  rateLimit,
  rateLimitResponse,
  requireApiKey,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const denied = requireApiKey(request);
    if (denied) return denied;
    const limited = rateLimit(`fivb:${clientIp(request)}`, 30, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "VNL";
    const tournamentNo = Number(url.searchParams.get("tournament") ?? "");
    const matchNo = Number(url.searchParams.get("match") ?? "");

    if (Number.isFinite(matchNo) && matchNo > 0) {
      const stats = await getFivbMatchStats(matchNo);
      return NextResponse.json({ ok: true, kind: "stats", stats });
    }

    if (Number.isFinite(tournamentNo) && tournamentNo > 0) {
      const matches = await listFivbMatches(tournamentNo);
      return NextResponse.json({ ok: true, kind: "matches", tournamentNo, matches });
    }

    const tournaments = await listFivbTournaments({ nameContains: q, limit: 25 });
    return NextResponse.json({ ok: true, kind: "tournaments", q, tournaments });
  } catch (error) {
    logServerError("fivb", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "FIVB VIS 조회 실패") },
      { status: publicErrorStatus(error) },
    );
  }
}
