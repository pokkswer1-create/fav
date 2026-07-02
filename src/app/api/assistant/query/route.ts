import { executeAssistantQuery } from "@/lib/assistant/execute";
import {
  classifyAssistantQuery,
  refineIntentWithOpenAI,
} from "@/lib/assistant/intent";
import { polishAssistantAnswer } from "@/lib/assistant/polish";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message가 필요합니다." }, { status: 400 });
  }

  const fromLlm = await refineIntentWithOpenAI(message);
  const classified = fromLlm ?? classifyAssistantQuery(message);

  try {
    const supabase = getSupabaseServer();
    const factualAnswer = await executeAssistantQuery(supabase, classified, {
      role: guard.role,
    });
    const polished = await polishAssistantAnswer(message, factualAnswer);
    const answer = polished ?? factualAnswer;
    const isAction =
      classified.topic === "action_notify_unpaid" || classified.topic === "action_refresh_kva";

    return NextResponse.json({
      answer,
      answerRaw: polished ? factualAnswer : undefined,
      topic: classified.topic,
      monthRef: classified.monthRef,
      isAction,
      usedOpenAIIntent: Boolean(fromLlm),
      usedOpenAIPolish: Boolean(polished),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
