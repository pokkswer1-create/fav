import { describe, expect, it } from "vitest";
import {
  COURT_SLOTS,
  emptyLineup,
  getLineupSlot,
  isLineupSeedMark,
  lineupToSeedMarks,
  mergeLineupIntoMarks,
  rotateLineup,
  setLineupSlot,
  updateLineupCoords,
} from "./court-lineup";
import { createPlayerMark } from "./player-marks";

describe("court lineup", () => {
  it("has six slots in front/back grid order", () => {
    expect(COURT_SLOTS.map((s) => s.slot)).toEqual([4, 3, 2, 5, 6, 1]);
  });

  it("assigns a player to a slot and clears duplicates", () => {
    let lineup = emptyLineup();
    lineup = setLineupSlot(
      lineup,
      { slot: 4, playerNumber: 7, playerName: "김하늘" },
      4,
    );
    lineup = setLineupSlot(
      lineup,
      { slot: 2, playerNumber: 7, playerName: "김하늘" },
      2,
    );
    expect(getLineupSlot(lineup, 4)).toBeNull();
    expect(getLineupSlot(lineup, 2)?.playerNumber).toBe(7);
  });

  it("builds seed marks from filled slots", () => {
    let lineup = emptyLineup();
    lineup = setLineupSlot(lineup, { slot: 4, playerNumber: 7, playerName: "김하늘" }, 4);
    lineup = setLineupSlot(lineup, { slot: 1, playerNumber: 10, playerName: "박세린" }, 1);
    const seeds = lineupToSeedMarks(lineup, 0);
    expect(seeds).toHaveLength(2);
    expect(seeds.every(isLineupSeedMark)).toBe(true);
    expect(seeds.find((s) => s.playerNumber === 7)?.xNorm).toBeCloseTo(0.28);
    expect(seeds.find((s) => s.playerNumber === 10)?.xNorm).toBeCloseTo(0.72);
  });

  it("merges lineup seeds while keeping click refinements", () => {
    const click = createPlayerMark({
      timeSec: 12,
      playerNumber: 7,
      playerName: "김하늘",
      xNorm: 0.55,
      yNorm: 0.5,
    });
    let lineup = emptyLineup();
    lineup = setLineupSlot(lineup, { slot: 4, playerNumber: 7, playerName: "김하늘" }, 4);
    const merged = mergeLineupIntoMarks([click], lineup, 0);
    expect(merged.filter(isLineupSeedMark)).toHaveLength(1);
    expect(merged.filter((m) => !isLineupSeedMark(m))).toHaveLength(1);
    expect(merged.find((m) => !isLineupSeedMark(m))?.timeSec).toBe(12);
  });

  it("rotates lineup on side-out advance", () => {
    let lineup = emptyLineup();
    lineup = setLineupSlot(lineup, { slot: 1, playerNumber: 1, playerName: "A" }, 1);
    lineup = setLineupSlot(lineup, { slot: 2, playerNumber: 2, playerName: "B" }, 2);
    const next = rotateLineup(lineup);
    expect(getLineupSlot(next, 6)?.playerNumber).toBe(1);
    expect(getLineupSlot(next, 1)?.playerNumber).toBe(2);
  });

  it("updates coords for video refine of a lineup player", () => {
    let lineup = emptyLineup();
    lineup = setLineupSlot(lineup, { slot: 3, playerNumber: 7, playerName: "김" }, 3);
    lineup = updateLineupCoords(lineup, 7, 0.44, 0.51);
    expect(getLineupSlot(lineup, 3)).toMatchObject({ xNorm: 0.44, yNorm: 0.51 });
  });
});
