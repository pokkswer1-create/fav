import { describe, expect, it } from "vitest";
import {
  analyzeRotations,
  attackZoneCounts,
  effectToTermination,
  nextRotation,
  setterDistribution,
  skillEfficiency,
  skillPercent,
  type CodedAction,
} from "./volley-codes";
import { buildDvwExport } from "./dvw-export";
import { filterActionsToClips } from "./scout-filters";

const sampleActions: CodedAction[] = [
  {
    id: "1",
    setIndex: 0,
    rallyIndex: 0,
    team: "home",
    skill: "A",
    effect: "#",
    playerNumber: 7,
    endZone: 4,
    rotation: 1,
    combination: "X5",
    videoTimeSec: 12,
    pointEnding: true,
  },
  {
    id: "2",
    setIndex: 0,
    rallyIndex: 1,
    team: "home",
    skill: "A",
    effect: "=",
    playerNumber: 7,
    endZone: 4,
    rotation: 1,
    combination: "X5",
    videoTimeSec: 20,
  },
  {
    id: "3",
    setIndex: 0,
    rallyIndex: 2,
    team: "home",
    skill: "A",
    effect: "+",
    playerNumber: 10,
    endZone: 2,
    rotation: 2,
    combination: "Pipe",
    videoTimeSec: 33,
  },
  {
    id: "4",
    setIndex: 0,
    rallyIndex: 3,
    team: "home",
    skill: "S",
    effect: "#",
    playerNumber: 4,
    startZone: 1,
    rotation: 1,
    videoTimeSec: 40,
    pointEnding: true,
  },
];

describe("volley skill efficiency (VSEFF-like)", () => {
  it("computes attack efficiency from quality grades", () => {
    const eff = skillEfficiency(sampleActions, "A");
    // (#1 + = -1 + +0.5) / 3 = 0.166...
    expect(eff).toBeCloseTo(0.1667, 3);
  });

  it("computes kill percent", () => {
    expect(skillPercent(sampleActions, "A", "#")).toBeCloseTo(1 / 3, 5);
  });
});

describe("rotation side-out / break", () => {
  it("buckets side-out and break by setter position", () => {
    const rows = analyzeRotations(
      [
        { serving: "away", winner: "home", homeRotation: 1 }, // side-out win
        { serving: "home", winner: "home", homeRotation: 1 }, // break win
        { serving: "away", winner: "away", homeRotation: 1 }, // side-out loss
      ],
      "home",
    );
    const r1 = rows.find((r) => r.rotation === 1)!;
    expect(r1.sideOutAttempts).toBe(2);
    expect(r1.sideOutWins).toBe(1);
    expect(r1.breakAttempts).toBe(1);
    expect(r1.breakWins).toBe(1);
    expect(r1.sideOutRate).toBe(0.5);
    expect(r1.breakRate).toBe(1);
  });

  it("advances rotation only on side-out win", () => {
    expect(nextRotation(1, false)).toBe(2);
    expect(nextRotation(6, false)).toBe(1);
    expect(nextRotation(3, true)).toBe(3);
  });
});

describe("setter distribution + zones", () => {
  it("groups attack combos", () => {
    const dist = setterDistribution(sampleActions);
    expect(dist[0].combination).toBe("X5");
    expect(dist[0].attempts).toBe(2);
    expect(dist[0].kills).toBe(1);
  });

  it("counts attack end zones", () => {
    const z = attackZoneCounts(sampleActions);
    expect(z[4]).toBe(2);
    expect(z[2]).toBe(1);
  });
});

describe("dvw export + video filters", () => {
  it("exports dvw-like lines", () => {
    const text = buildDvwExport({
      homeName: "FAV",
      awayName: "SEO",
      date: "2026-09-09",
      actions: sampleActions,
    });
    expect(text).toContain("[3DATAVOLLEY");
    expect(text).toContain("a7A#");
  });

  it("filters actions into video clips", () => {
    const clips = filterActionsToClips(sampleActions, {
      skill: "A",
      effect: "#",
      durationSec: 60,
      padSec: 1,
    });
    expect(clips).toHaveLength(1);
    expect(clips[0].startSec).toBeLessThan(12);
    expect(clips[0].endSec).toBeGreaterThan(12);
  });
});

describe("effect mapping", () => {
  it("maps kill/ace/error terminations", () => {
    expect(effectToTermination("A", "#", true)).toBe("kill");
    expect(effectToTermination("S", "#", true)).toBe("ace");
    expect(effectToTermination("A", "=", false)).toBe("our_error");
  });
});
