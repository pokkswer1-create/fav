import { describe, expect, it } from "vitest";
import { createPlayerMark } from "./player-marks";
import {
  listStaticTrackPins,
  resolveFollowPin,
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

  it("snaps to a single pin near its time", () => {
    const marks = [pinMark(10, 7, 0.3, 0.4, "김하늘")];
    const hit = resolveFollowPin(marks, 10.2, { playerNumber: 7 });
    expect(hit).toMatchObject({
      playerNumber: 7,
      playerName: "김하늘",
      xNorm: 0.3,
      yNorm: 0.4,
    });
    expect(hit!.opacity).toBeGreaterThan(0.5);
  });

  it("fades out when far from a lone pin", () => {
    const marks = [pinMark(10, 7, 0.3, 0.4)];
    expect(resolveFollowPin(marks, 30, { playerNumber: 7 })).toBeNull();
  });

  it("lerps between two pins of the same player", () => {
    const marks = [pinMark(10, 7, 0, 0, "김하늘"), pinMark(20, 7, 1, 1, "김하늘")];
    const mid = resolveFollowPin(marks, 15, { playerNumber: 7 });
    expect(mid).toMatchObject({ xNorm: 0.5, yNorm: 0.5, playerNumber: 7 });
    expect(mid!.opacity).toBe(1);
    expect(mid!.mode).toBe("lerp");
  });

  it("ignores other players when playerNumber is set", () => {
    const marks = [pinMark(10, 10, 0.1, 0.1, "박"), pinMark(12, 7, 0.8, 0.8, "김")];
    const hit = resolveFollowPin(marks, 12, { playerNumber: 7 });
    expect(hit?.playerNumber).toBe(7);
    expect(hit?.xNorm).toBe(0.8);
  });

  it("prefers active player, else nearest positional mark player", () => {
    const marks = [pinMark(10, 7, 0.2, 0.2), pinMark(10.1, 10, 0.9, 0.9)];
    const hit = resolveFollowPin(marks, 10.05);
    expect(hit).not.toBeNull();
    expect([7, 10]).toContain(hit!.playerNumber);
  });
});

describe("listStaticTrackPins", () => {
  it("lists only marks with coordinates", () => {
    const marks = [
      pinMark(5, 7, 0.2, 0.3),
      createPlayerMark({ timeSec: 6, playerNumber: 7, playerName: "김" }),
      pinMark(8, 10, 0.5, 0.6),
    ];
    const pins = listStaticTrackPins(marks);
    expect(pins).toHaveLength(2);
    expect(pins.every((p: TrackPin) => typeof p.xNorm === "number")).toBe(true);
  });
});
