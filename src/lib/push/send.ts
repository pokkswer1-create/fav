import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { ensureVapidConfigured } from "@/lib/push/vapid";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type SubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function toWebPushSubscription(row: SubRow) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

export async function sendPushToSubscription(
  row: SubRow,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; statusCode?: number }> {
  if (!ensureVapidConfigured()) return { ok: false };
  const sub = toWebPushSubscription(row);
  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
  });
  try {
    await webpush.sendNotification(sub, data, {
      TTL: 3600,
      urgency: "normal",
    });
    return { ok: true };
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : undefined;
    return { ok: false, statusCode };
  }
}

export async function broadcastPush(
  supabase: SupabaseClient,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removedStale: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, removedStale: 0 };
  }

  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  let removedStale = 0;

  for (const row of (rows ?? []) as SubRow[]) {
    const r = await sendPushToSubscription(row, payload);
    if (r.ok) {
      sent += 1;
      continue;
    }
    failed += 1;
    if (r.statusCode === 410 || r.statusCode === 404) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      removedStale += 1;
    }
  }

  return { sent, failed, removedStale };
}
