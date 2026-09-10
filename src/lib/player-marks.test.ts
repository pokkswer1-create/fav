import { describe, expect, it } from "vitest";
import {
  createPlayerMark,
  groupMarksByPlayer,
  marksToClips,
  summarizeMarks,
} from "./player-marks";

describe("manual player marks", () => {
  it("creates a clamped mark with optional click position", () => {
    const mark = createPlayerMark({
      timeSec: 12.34,
      playerNumber: 7,
      playerName: "김하늘",
      xNorm: 0.42,
      yNorm: 1.4,
    });
    expect(mark.timeSec).toBe(12.3);
    expect(mark.playerNumber).toBe(7);
    expect(mark.playerName).toBe("김하늘");
    expect(mark.xNorm).toBe(0.42);
    expect(mark.yNorm).toBe(1);
  });

  it("groups marks by jersey number", () => {
    const marks = [
      createPlayerMark({ timeSec: 10, playerNumber: 7, playerName: "김하늘" }),
      createPlayerMark({ timeSec: 20, playerNumber: 10, playerName: "박세린" }),
      createPlayerMark({ timeSec: 12, playerNumber: 7, playerName: "김하늘" }),
    ];
    const grouped = groupMarksByPlayer(marks);
    expect(grouped.get(7)?.map((m) => m.timeSec)).toEqual([10, 12]);
    expect(grouped.get(10)).toHaveLength(1);
  });

  it("merges nearby marks for the same player into clips", () => {
    const marks = [
      createPlayerMark({ timeSec: 10, playerNumber: 7, playerName: "김하늘" }),
      createPlayerMark({ timeSec: 11.5, playerNumber: 7, playerName: "김하늘" }),
      createPlayerMark({ timeSec: 40, playerNumber: 7, playerName: "김하늘" }),
      createPlayerMark({ timeSec: 41, playerNumber: 10, playerName: "박세린" }),
    ];
    const clips = marksToClips(marks, 90, { padSec: 1, mergeGapSec: 2 });
    expect(clips.length).toBe(3);
    expect(clips.every((c) => c.endSec > c.startSec)).toBe(true);
    expect(clips.some((c) => c.playerNumber === 7 && c.label.includes("김하늘"))).toBe(true);
    expect(clips.some((c) => c.playerNumber === 10)).toBe(true);
  });

  it("can build clips for one player only", () => {
    const marks = [
      createPlayerMark({ timeSec: 5, playerNumber: 4, playerName: "이준호" }),
      createPlayerMark({ timeSec: 25, playerNumber: 7, playerName: "김하늘" }),
    ];
    const clips = marksToClips(marks, 60, { onlyPlayerNumber: 7, padSec: 1 });
    expect(clips).toHaveLength(1);
    expect(clips[0].playerNumber).toBe(7);
    expect(clips[0].startSec).toBeLessThan(25);
  });

  it("summarizes mark counts per player", () => {
    const marks = [
      createPlayerMark({ timeSec: 1, playerNumber: 7, playerName: "김하늘" }),
      createPlayerMark({ timeSec: 2, playerNumber: 7, playerName: "김하늘" }),
      createPlayerMark({ timeSec: 3, playerNumber: 10, playerName: "박세린" }),
    ];
    expect(summarizeMarks(marks)).toEqual([
      { playerNumber: 7, playerName: "김하늘", count: 2 },
      { playerNumber: 10, playerName: "박세린", count: 1 },
    ]);
  });
});
