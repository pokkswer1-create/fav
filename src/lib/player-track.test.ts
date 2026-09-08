import { describe, expect, it } from "vitest";
import {
  clusterDetectionsToClips,
  mergePlayerClips,
  statsTimelineClips,
} from "./player-track";

describe("player tracking helpers", () => {
  it("clusters nearby jersey detections into clips", () => {
    const clips = clusterDetectionsToClips(
      [
        { timeSec: 2.0, number: 7 },
        { timeSec: 2.5, number: 7 },
        { timeSec: 3.0, number: 7 },
        { timeSec: 10.0, number: 7 },
        { timeSec: 10.4, number: 7 },
      ],
      {
        playerNumber: 7,
        playerName: "김하늘",
        durationSec: 20,
      },
    );
    expect(clips.length).toBe(2);
    expect(clips[0].playerNumber).toBe(7);
    expect(clips[0].label).toContain("김하늘");
    expect(clips[0].endSec).toBeGreaterThan(clips[0].startSec);
  });

  it("builds stats timeline clips for a scorer", () => {
    const clips = statsTimelineClips(
      {
        id: "p1",
        name: "박세린",
        number: 10,
        position: "OPP",
        attacks: 20,
        kills: 3,
        attackErrors: 1,
        blocks: 1,
        digs: 2,
        aces: 2,
        serveErrors: 0,
        receptions: 0,
        receptionErrors: 0,
        sets: 0,
        setErrors: 0,
      },
      20,
    );
    expect(clips.length).toBeGreaterThan(0);
    expect(clips.every((c) => c.playerNumber === 10)).toBe(true);
  });

  it("merges overlapping ocr and stats clips", () => {
    const merged = mergePlayerClips(
      [
        {
          id: "a",
          startSec: 1,
          endSec: 4,
          kind: "custom",
          label: "#7 트래킹 #1",
          playerNumber: 7,
          playerName: "김하늘",
        },
      ],
      [
        {
          id: "b",
          startSec: 2,
          endSec: 5,
          kind: "kill",
          label: "#7 킬 #1",
          playerNumber: 7,
          playerName: "김하늘",
        },
      ],
      20,
    );
    expect(merged.length).toBe(1);
    expect(merged[0].endSec).toBeGreaterThanOrEqual(4);
  });
});
