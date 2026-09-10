import { describe, expect, it } from "vitest";
import {
  alignClipsToDuration,
  assertClipsWithinDuration,
  totalClipDuration,
} from "./clip-align";
import {
  analyzeSideOut,
  appendCodedAction,
  buildMatchFromScout,
  clipsFromScoutPoints,
  computeSetScores,
  emptyPlayer,
  type ScoutSession,
} from "./scout";

describe("clip alignment (no misalignment)", () => {
  it("clamps clips inside duration and removes invalid spans", () => {
    const aligned = alignClipsToDuration(
      [
        { id: "1", startSec: -2, endSec: 3, kind: "kill", label: "a" },
        { id: "2", startSec: 18, endSec: 30, kind: "ace", label: "b" },
        { id: "3", startSec: 5, endSec: 4, kind: "block", label: "c" },
      ],
      20,
    );
    expect(aligned.length).toBeGreaterThan(0);
    const check = assertClipsWithinDuration(aligned, 20);
    expect(check.ok).toBe(true);
    expect(aligned.every((c) => c.endSec <= 20)).toBe(true);
    expect(aligned.every((c) => c.startSec >= 0)).toBe(true);
  });

  it("trims overlapping clips instead of stacking", () => {
    const aligned = alignClipsToDuration(
      [
        { id: "1", startSec: 1, endSec: 5, kind: "kill", label: "a" },
        { id: "2", startSec: 3, endSec: 8, kind: "ace", label: "b" },
      ],
      20,
      { minLen: 0.8 },
    );
    expect(aligned).toHaveLength(2);
    expect(aligned[1].startSec).toBeGreaterThanOrEqual(aligned[0].endSec);
    expect(totalClipDuration(aligned)).toBeLessThanOrEqual(20);
  });

  it("returns empty when duration is unknown", () => {
    expect(
      alignClipsToDuration([{ id: "1", startSec: 0, endSec: 2, kind: "kill", label: "a" }], 0),
    ).toEqual([]);
  });
});

describe("point scouting engine", () => {
  const session: ScoutSession = {
    id: "s1",
    matchId: "m1",
    title: "테스트 스카우트",
    createdAt: "2026-03-21T10:00:00.000Z",
    updatedAt: "2026-03-21T11:00:00.000Z",
    homeName: "FAV",
    awayName: "서울",
    points: [
      {
        id: "p1",
        setIndex: 0,
        pointIndex: 0,
        serving: "home",
        winner: "home",
        termination: "ace",
        playerNumber: 7,
        playerName: "김하늘",
        videoTimeSec: 2.5,
      },
      {
        id: "p2",
        setIndex: 0,
        pointIndex: 1,
        serving: "home",
        winner: "away",
        termination: "kill",
        playerNumber: 8,
        playerName: "상대",
        videoTimeSec: 8,
      },
      {
        id: "p3",
        setIndex: 0,
        pointIndex: 2,
        serving: "away",
        winner: "home",
        termination: "block",
        playerNumber: 4,
        playerName: "이준호",
        videoTimeSec: 15,
      },
      {
        id: "p4",
        setIndex: 0,
        pointIndex: 3,
        serving: "home",
        winner: "home",
        termination: "kill",
        playerNumber: 7,
        playerName: "김하늘",
        videoTimeSec: 18,
      },
    ],
  };

  it("computes set scores and side-out rates", () => {
    const sets = computeSetScores(session.points);
    expect(sets[0]).toMatchObject({ home: 3, away: 1 });
    const side = analyzeSideOut(session.points);
    expect(side.homeSideOutRate).toBe(1); // 1/1 when away served
    expect(side.longestHomeRun).toBeGreaterThanOrEqual(1);
  });

  it("builds match box score from points", () => {
    const match = buildMatchFromScout(session, {
      home: [
        emptyPlayer({ id: "h7", name: "김하늘", number: 7, position: "OH" }),
        emptyPlayer({ id: "h4", name: "이준호", number: 4, position: "MB" }),
      ],
      away: [emptyPlayer({ id: "a8", name: "상대", number: 8, position: "OH" })],
    });
    const kim = match.home.players.find((p) => p.number === 7)!;
    expect(kim.aces).toBe(1);
    expect(kim.kills).toBe(1);
    const jun = match.home.players.find((p) => p.number === 4)!;
    expect(jun.blocks).toBe(1);
  });

  it("creates video-aligned clips from timestamps without exceeding duration", () => {
    const clips = clipsFromScoutPoints(session.points, 20, { onlyPlayerNumber: 7 });
    expect(clips.length).toBe(2);
    const check = assertClipsWithinDuration(alignClipsToDuration(clips, 20), 20);
    expect(check.ok).toBe(true);
    expect(clips.every((c) => c.playerNumber === 7)).toBe(true);
  });
});

describe("pro coded actions", () => {
  it("appends coded action and rotates on side-out win", () => {
    const base: ScoutSession = {
      id: "code-1",
      matchId: "m1",
      title: "t",
      createdAt: "t",
      updatedAt: "t",
      homeName: "FAV",
      awayName: "SEO",
      points: [],
      actions: [],
      homeRotation: 1,
      awayRotation: 1,
    };
    const next = appendCodedAction(
      base,
      {
        setIndex: 0,
        team: "home",
        skill: "A",
        effect: "#",
        playerNumber: 7,
        endZone: 4,
        combination: "X5",
        videoTimeSec: 5,
        pointEnding: true,
      },
      { winner: "home", serving: "away" },
    );
    expect(next.actions).toHaveLength(1);
    expect(next.points).toHaveLength(1);
    expect(next.points[0].termination).toBe("kill");
    expect(next.homeRotation).toBe(2);
  });
});
