import {
  formatClassSlotMessage,
  formatTodayDigest,
  getTodayAttendanceSnapshot,
} from "@/lib/home/attendance-snapshot";
import { hmToTotalMinutes, koreaDateString, koreaHourMinute, koreaTimeTotalMinutes } from "@/lib/datetime/korea";
import { broadcastPush } from "@/lib/push/send";
import { ensureVapidConfigured } from "@/lib/push/vapid";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function authorizeCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}

async function alreadyDispatched(supabase: ReturnType<typeof getSupabaseServer>, key: string) {
  const { data } = await supabase.from("push_dispatch_log").select("id").eq("dispatch_key", key).maybeSingle();
  return Boolean(data?.id);
}

async function markDispatched(
  supabase: ReturnType<typeof getSupabaseServer>,
  key: string,
  type: string
) {
  const { error } = await supabase
    .from("push_dispatch_log")
    .insert({ dispatch_key: key, dispatch_type: type });
  if (error && !error.message.toLowerCase().includes("duplicate") && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ensureVapidConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "vapid_not_configured" });
  }

  const supabase = getSupabaseServer();
  let snapshot;
  try {
    snapshot = await getTodayAttendanceSnapshot(supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "snapshot failed";
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      return NextResponse.json({ ok: true, skipped: true, reason: "tables_missing" });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const date = koreaDateString();
  const { hour, minute } = koreaHourMinute();
  const nowM = koreaTimeTotalMinutes();

  let digestSent = 0;
  let slotSent = 0;
  const errors: string[] = [];

  const digestKey = `push-digest-${date}`;
  const inMorningDigestWindow = hour === 8 && minute < 15;

  if (inMorningDigestWindow) {
    const exists = await alreadyDispatched(supabase, digestKey);
    if (!exists) {
      const body = formatTodayDigest(snapshot);
      const r = await broadcastPush(supabase, {
        title: `오늘(${date}) 출석·결석`,
        body: body.length > 220 ? `${body.slice(0, 219)}…` : body,
        url: "/",
        tag: digestKey,
      });
      digestSent = r.sent;
      await markDispatched(supabase, digestKey, "attendance_digest");
      if (r.failed > r.removedStale) errors.push(`digest_push_partial_fail:${r.failed}`);
    }
  }

  for (const c of snapshot.classes) {
    const startM = hmToTotalMinutes(c.startTime);
    const delta = nowM - startM;
    if (delta < 0 || delta > 14) continue;

    const slotKey = `push-slot-${c.classId}-${date}-${c.startTime}`;
    const exists = await alreadyDispatched(supabase, slotKey);
    if (exists) continue;

    const msg = formatClassSlotMessage(c);
    const r = await broadcastPush(supabase, {
      title: `${c.name} (${c.startTime})`,
      body: msg.length > 200 ? `${msg.slice(0, 199)}…` : msg,
      url: "/",
      tag: slotKey,
    });
    slotSent += r.sent;
    await markDispatched(supabase, slotKey, "class_slot");
    if (r.failed > r.removedStale) errors.push(`slot_${c.classId}:${r.failed}`);
  }

  return NextResponse.json({
    ok: true,
    date,
    digestSent,
    slotSent,
    errors: errors.length ? errors : undefined,
  });
}
