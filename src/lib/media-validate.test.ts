import { describe, expect, it } from "vitest";
import {
  assertDurationAllowedForAutoAnalyze,
  formatDurationLabel,
  MAX_DURATION_SEC,
  MAX_UPLOAD_BYTES,
  looksLikeVideoContainer,
} from "./media-validate";
import { SafeHttpError } from "./security";

describe("long match media limits", () => {
  it("allows up to 4 hours by default", () => {
    expect(MAX_DURATION_SEC).toBeGreaterThanOrEqual(14_400);
  });

  it("allows multi-GB uploads by default (full match files)", () => {
    expect(MAX_UPLOAD_BYTES).toBeGreaterThanOrEqual(8 * 1024 * 1024 * 1024);
  });

  it("formats hour-scale durations for UI", () => {
    expect(formatDurationLabel(480)).toBe("8분");
    expect(formatDurationLabel(3600)).toBe("1시간");
    expect(formatDurationLabel(4903)).toMatch(/1시간/);
    expect(formatDurationLabel(14_400)).toBe("4시간");
  });

  it("recognizes mp4 ftyp magic", () => {
    const buf = Buffer.alloc(32);
    buf.write("ftyp", 4, "ascii");
    expect(looksLikeVideoContainer(buf)).toBe(true);
  });

  it("blocks auto-detect/OCR on multi-hour sources", () => {
    expect(() => assertDurationAllowedForAutoAnalyze(14_400)).toThrow(SafeHttpError);
    expect(() => assertDurationAllowedForAutoAnalyze(60)).not.toThrow();
  });
});
