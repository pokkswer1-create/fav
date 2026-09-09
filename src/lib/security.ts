import { NextResponse } from "next/server";

const DEFAULT_DEV_KEY = "fav-local-dev-key";

export function getExpectedApiKey(): string {
  return process.env.FAV_API_KEY?.trim() || DEFAULT_DEV_KEY;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "local";
}

export function requireApiKey(request: Request): NextResponse | null {
  const expected = getExpectedApiKey();
  const headerKey =
    request.headers.get("x-fav-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key") || "";
  const provided = headerKey || queryKey;
  if (provided !== expected) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  return null;
}

type Bucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

let heavyJobs = 0;
const HEAVY_MAX = Number(process.env.FAV_HEAVY_CONCURRENCY || 2);

export async function withHeavyJob<T>(fn: () => Promise<T>): Promise<T> {
  if (heavyJobs >= HEAVY_MAX) {
    throw new SafeHttpError(429, "처리 중인 작업이 많습니다. 잠시 후 다시 시도하세요.");
  }
  heavyJobs += 1;
  try {
    return await fn();
  } finally {
    heavyJobs -= 1;
  }
}

export class SafeHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function logServerError(scope: string, error: unknown): void {
  const detail = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[fav-security:${scope}]`, detail);
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SafeHttpError) return error.message;
  return fallback;
}

export function publicErrorStatus(error: unknown, fallback = 400): number {
  if (error instanceof SafeHttpError) return error.status;
  return fallback;
}

/** Soft body size gate using Content-Length when present. */
export function enforceContentLength(request: Request, maxBytes: number): NextResponse | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n > maxBytes) {
    return NextResponse.json({ error: "요청 본문이 너무 큽니다." }, { status: 413 });
  }
  return null;
}
