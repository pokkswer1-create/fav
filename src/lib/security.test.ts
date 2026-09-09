import { describe, expect, it } from "vitest";
import { looksLikeVideoContainer } from "./media-validate";
import { getExpectedApiKey, publicErrorMessage, rateLimit, SafeHttpError } from "./security";
import { clipsPayloadSchema, matchInputSchema } from "./schemas";
import { demoMatch } from "./demo-match";

describe("security helpers", () => {
  it("rate-limits after threshold", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    const third = rateLimit(key, 2, 60_000);
    expect(third.ok).toBe(false);
  });

  it("masks unknown errors", () => {
    expect(publicErrorMessage(new Error("ffmpeg boom /tmp/secret"), "실패")).toBe("실패");
    expect(publicErrorMessage(new SafeHttpError(429, "바빠요"), "실패")).toBe("바빠요");
  });

  it("has a default api key in local mode", () => {
    expect(getExpectedApiKey().length).toBeGreaterThan(8);
  });
});

describe("schema validation", () => {
  it("accepts demo match", () => {
    expect(matchInputSchema.safeParse(demoMatch).success).toBe(true);
  });

  it("rejects oversized player lists", () => {
    const bad = {
      ...demoMatch,
      home: {
        ...demoMatch.home,
        players: Array.from({ length: 25 }, (_, i) => ({
          ...demoMatch.home.players[0],
          id: `x${i}`,
          number: i,
        })),
      },
    };
    expect(matchInputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects too many clips", () => {
    const clips = Array.from({ length: 25 }, (_, i) => ({
      id: `c${i}`,
      startSec: i,
      endSec: i + 1,
      kind: "kill" as const,
      label: "x",
    }));
    expect(clipsPayloadSchema.safeParse(clips).success).toBe(false);
  });
});

describe("media magic bytes", () => {
  it("detects ftyp mp4 signature", () => {
    const buf = Buffer.alloc(32);
    buf.write("xxxxftypisom", 0, "ascii");
    expect(looksLikeVideoContainer(buf)).toBe(true);
  });

  it("rejects random bytes", () => {
    expect(looksLikeVideoContainer(Buffer.from("not-a-video-file!!!!"))).toBe(false);
  });
});
