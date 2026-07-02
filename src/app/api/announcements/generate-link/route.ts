import { requireRole } from "@/lib/auth/guards";
import { NextResponse } from "next/server";

function makeToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  if (!body.externalFormUrl) {
    return NextResponse.json({ error: "externalFormUrl이 필요합니다." }, { status: 400 });
  }
  const token = makeToken();
  const shortUrl = `${new URL(request.url).origin}/announcements/${token}`;
  return NextResponse.json({ linkToken: token, shortUrl });
}
