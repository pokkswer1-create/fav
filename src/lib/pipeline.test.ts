import { describe, expect, it } from "vitest";
import { createDemoScoutSession } from "./demo-scout";
import { alignClipsToDuration, assertClipsWithinDuration } from "./clip-align";
import { clipsFromScoutPoints } from "./scout";
import { analyzeMatch } from "./analysis";
import { buildMatchFromScout } from "./scout";
import { demoMatch } from "./demo-match";
import { buildMarkdownReport } from "./report";

describe("end-to-end scout → clip pipeline", () => {
  it("demo scout clips always fit the sample 20s video", () => {
    const session = createDemoScoutSession();
    const raw = clipsFromScoutPoints(session.points, 20);
    const aligned = alignClipsToDuration(raw, 20);
    expect(aligned.length).toBeGreaterThan(0);
    expect(assertClipsWithinDuration(aligned, 20).ok).toBe(true);
    for (let i = 1; i < aligned.length; i += 1) {
      expect(aligned[i].startSec).toBeGreaterThanOrEqual(aligned[i - 1].endSec);
    }
  });

  it("player-only clips stay inside duration after realign to shorter media", () => {
    const session = createDemoScoutSession();
    const raw = clipsFromScoutPoints(session.points, 20, { onlyPlayerNumber: 7 });
    const aligned = alignClipsToDuration(raw, 12);
    expect(aligned.every((c) => c.endSec <= 12)).toBe(true);
    expect(assertClipsWithinDuration(aligned, 12).ok).toBe(true);
  });

  it("scout → match → analysis → report is deterministic", () => {
    const session = createDemoScoutSession();
    const match = buildMatchFromScout(session, {
      home: demoMatch.home.players,
      away: demoMatch.away.players,
    });
    const analysis = analyzeMatch(match);
    const md = buildMarkdownReport(match, analysis, session);
    expect(md).toContain(match.title);
    expect(md).toContain("포인트 스카우트");
    expect(analysis.home.keyPlayers.length).toBeGreaterThan(0);
  });

  it("rejects clips that would exceed media after align", () => {
    const aligned = alignClipsToDuration(
      [
        { id: "x", startSec: 19.5, endSec: 25, kind: "kill", label: "late" },
        { id: "y", startSec: 50, endSec: 55, kind: "ace", label: "oob" },
      ],
      20,
    );
    expect(aligned.every((c) => c.endSec <= 20)).toBe(true);
    expect(assertClipsWithinDuration(aligned, 20).ok).toBe(true);
  });
});
