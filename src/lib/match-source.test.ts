import { describe, expect, it } from "vitest";
import { resolveBundledMatchPath } from "./match-source";

describe("resolveBundledMatchPath", () => {
  it("resolves a known catalog id to public/match file", () => {
    const p = resolveBundledMatchPath("set1-3min");
    expect(p).toBeTruthy();
    expect(p).toContain("/public/match/set1-3min.mp4");
  });

  it("rejects unknown ids and path tricks", () => {
    expect(resolveBundledMatchPath("")).toBeNull();
    expect(resolveBundledMatchPath("no-such-video")).toBeNull();
    expect(resolveBundledMatchPath("../etc/passwd")).toBeNull();
  });
});
