import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  if (!UUID_RE.test(guard.userId)) {
    return NextResponse.json(
      {
        error:
          "웹 푸시는 Supabase에 프로필이 있는 계정으로 로그인한 뒤 등록할 수 있습니다. (개발 우회 모드에서는 미지원)",
      },
      { status: 400 }
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "endpoint와 keys가 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: guard.userId,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    if (error.message.includes("push_subscriptions") && error.message.includes("does not exist")) {
      return NextResponse.json(
        { error: "push_subscriptions 테이블이 없습니다. Supabase에 스키마를 적용해 주세요." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
