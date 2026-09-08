import { describe, expect, it } from "vitest";
import { buildTeamHeatmap, kindForPeakIntensity } from "./heatmap";
import { demoMatch } from "./demo-match";
import { parseSilenceGaps, peaksToClips, windowsToPeaks } from "./scene-detect";

describe("court heatmap", () => {
  it("maps FAV activity into court zones with hot spots", () => {
    const heat = buildTeamHeatmap(demoMatch.home);
    expect(heat.zones).toHaveLength(6);
    expect(heat.hotZones.length).toBe(2);
    expect(heat.zones.every((z) => z.value >= 0 && z.value <= 1)).toBe(true);
    const max = Math.max(...heat.zones.map((z) => z.value));
    expect(max).toBe(1);
  });
});

describe("scene detect helpers", () => {
  it("parses silence gaps into activity windows", () => {
    const log = `
silence_start: 0.5
silence_end: 1.2 | silence_duration: 0.7
silence_start: 5.0
silence_end: 6.1 | silence_duration: 1.1
silence_start: 12.0
`;
    const windows = parseSilenceGaps(log, 15);
    expect(windows.length).toBeGreaterThanOrEqual(2);
    expect(windows[0].start).toBeLessThan(windows[0].end);
  });

  it("converts peaks into non-overlapping clips", () => {
    const peaks = windowsToPeaks(
      [
        { start: 1, end: 4 },
        { start: 7, end: 11 },
        { start: 14, end: 17 },
      ],
      20,
    );
    const clips = peaksToClips(peaks, 20);
    expect(clips.length).toBeGreaterThan(0);
    for (let i = 1; i < clips.length; i += 1) {
      expect(clips[i].startSec).toBeGreaterThanOrEqual(clips[i - 1].startSec);
    }
    expect(kindForPeakIntensity(0.9)).toBe("kill");
  });
});
