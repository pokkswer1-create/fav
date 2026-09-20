import { describe, expect, it } from "vitest";
import { createPlayerMark } from "./player-marks";
import {
  listStaticTrackPins,
  resolveAllFollowPins,
  resolveFollowPin,
  summarizePlayerTracks,
  trackColorForPlayer,
  type TrackPin,
} from "./track-overlay";

function pinMark(
  timeSec: number,
  number: number,
  x: number,
  y: number,
  name = "선수",
) {
  return createPlayerMark({
    timeSec,
    playerNumber: number,
    playerName: name,
    xNorm: x,
    yNorm: y,
  });
}

describe("resolveFollowPin", () => {
  it("returns null when no positional marks", () => {
    const marks = [createPlayerMark({ timeSec: 5, playerNumber: 7, playerName: "김하늘" })];
    expect(resolveFollowPin(marks, 5)).toBeNull();
  });

  it("holds a single pin from stamp time through the end", () => {
    const marks = [pinMark(10, 7, 0.3, 0.4, "김하늘")];
    expect(resolveFollowPin(marks, 9.9, { playerNumber: 7 })).toBeNull();
    const late = resolveFollowPin(marks, 170, { playerNumber: 7, durationSec: 180 });
    expect(late).toMatchObject({ xNorm: 0.3, yNorm: 0.4, mode: "hold", opacity: 1 });
  });

  it("lerps between two pins of the same player", () => {
    const marks = [pinMark(10, 7, 0, 0, "김하늘"), pinMark(20, 7, 1, 1, "김하늘")];
    const mid = resolveFollowPin(marks, 15, { playerNumber: 7, durationSec: 90 });
    expect(mid).toMatchObject({ xNorm: 0.5, yNorm: 0.5, playerNumber: 7, mode: "lerp" });
  });

  it("holds the last pin after the final stamp until the end", () => {
    const marks = [pinMark(10, 7, 0, 0), pinMark(20, 7, 1, 1)];
    const after = resolveFollowPin(marks, 80, { playerNumber: 7, durationSec: 120 });
    expect(after).toMatchObject({ xNorm: 1, yNorm: 1, mode: "hold" });
  });
});

describe("resolveAllFollowPins", () => {
  it("returns an independent follow pin per player", () => {
    const marks = [
      pinMark(5, 7, 0.2, 0.2, "김하늘"),
      pinMark(10, 7, 0.4, 0.4, "김하늘"),
      pinMark(6, 10, 0.8, 0.3, "박세린"),
      pinMark(12, 10, 0.6, 0.7, "박세린"),
    ];
    const pins = resolveAllFollowPins(marks, 11, { durationSec: 60 });
    expect(pins).toHaveLength(2);
    const byNum = Object.fromEntries(pins.map((p) => [p.playerNumber, p]));
    expect(byNum[7].xNorm).toBeCloseTo(0.4);
    expect(byNum[7].mode).toBe("hold");
    expect(byNum[10].mode).toBe("lerp");
    expect(byNum[7].color).toBe(trackColorForPlayer(7));
    expect(byNum[10].color).toBe(trackColorForPlayer(10));
    expect(byNum[7].color).not.toBe(byNum[10].color);
  });

  it("keeps each player's path after their own first stamp only", () => {
    const marks = [pinMark(20, 7, 0.1, 0.1), pinMark(5, 10, 0.9, 0.9)];
    const early = resolveAllFollowPins(marks, 8, { durationSec: 60 });
    expect(early.map((p) => p.playerNumber)).toEqual([10]);
    const late = resolveAllFollowPins(marks, 25, { durationSec: 60 });
    expect(late.map((p) => p.playerNumber).sort((a, b) => a - b)).toEqual([7, 10]);
  });
});

describe("summarizePlayerTracks", () => {
  it("counts positional pins per player; ready with at least one pin", () => {
    const marks = [
      pinMark(1, 7, 0.2, 0.2, "김하늘"),
      pinMark(2, 7, 0.3, 0.3, "김하늘"),
      pinMark(1, 10, 0.5, 0.5, "박"),
    ];
    const summary = summarizePlayerTracks(marks);
    expect(summary).toEqual([
      { playerNumber: 7, playerName: "김하늘", pinCount: 2, ready: true },
      { playerNumber: 10, playerName: "박", pinCount: 1, ready: true },
    ]);
  });
});

describe("listStaticTrackPins", () => {
  it("lists only marks with coordinates and colors", () => {
    const marks = [
      pinMark(5, 7, 0.2, 0.3),
      createPlayerMark({ timeSec: 6, playerNumber: 7, playerName: "김" }),
      pinMark(8, 10, 0.5, 0.6),
    ];
    const pins = listStaticTrackPins(marks);
    expect(pins).toHaveLength(2);
    expect(pins.every((p: TrackPin) => typeof p.color === "string")).toBe(true);
  });
});
