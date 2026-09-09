import { describe, expect, it } from "vitest";
import {
  captureClockFromPlayer,
  nextClockAfterSeek,
  shouldAutoFollowPlayback,
} from "./video-clock";
import {
  exportLibraryBundle,
  importLibraryBundle,
  type LibraryBundle,
} from "./library-bundle";
import { filterConfidentDetections, scoreTrackQuality } from "./player-track";
import { alignClipsToDuration, assertClipsWithinDuration } from "./clip-align";
import { clipsFromScoutPoints, emptyPlayer, type ScoutSession } from "./scout";

describe("video clock sync", () => {
  it("captures currentTime rounded for scout stamps", () => {
    expect(captureClockFromPlayer({ currentTime: 12.345 })).toBe(12.3);
    expect(captureClockFromPlayer({ currentTime: Number.NaN })).toBe(0);
  });

  it("keeps follow mode until user edits clock manually", () => {
    expect(shouldAutoFollowPlayback({ followPlayback: true, manualOverride: false })).toBe(true);
    expect(shouldAutoFollowPlayback({ followPlayback: true, manualOverride: true })).toBe(false);
  });

  it("seeks without going negative", () => {
    expect(nextClockAfterSeek(3, -5)).toBe(0);
    expect(nextClockAfterSeek(10, 2.5)).toBe(12.5);
  });
});

describe("library bundle import/export", () => {
  it("round-trips matches and scout sessions", () => {
    const bundle: LibraryBundle = {
      version: 1,
      exportedAt: "2026-09-09T00:00:00.000Z",
      matches: [
        {
          id: "m1",
          savedAt: "2026-09-09T00:00:00.000Z",
          match: {
            id: "m1",
            title: "t",
            date: "2026-09-09",
            venue: "v",
            home: {
              name: "FAV",
              shortName: "FAV",
              players: [emptyPlayer({ id: "h7", name: "A", number: 7, position: "OH" })],
              setScores: [25],
            },
            away: {
              name: "SEO",
              shortName: "SEO",
              players: [emptyPlayer({ id: "a1", name: "B", number: 1, position: "OH" })],
              setScores: [20],
            },
          },
        },
      ],
      scouts: [
        {
          id: "s1",
          matchId: "m1",
          title: "t",
          createdAt: "2026-09-09T00:00:00.000Z",
          updatedAt: "2026-09-09T00:00:00.000Z",
          homeName: "FAV",
          awayName: "SEO",
          points: [],
        },
      ],
    };
    const json = exportLibraryBundle(bundle);
    const parsed = importLibraryBundle(json);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.scouts[0].matchId).toBe("m1");
  });

  it("rejects invalid bundles", () => {
    expect(() => importLibraryBundle("{}")).toThrow(/version/);
  });
});

describe("tracking confidence + long media alignment", () => {
  it("drops low-confidence detections", () => {
    const kept = filterConfidentDetections(
      [
        { timeSec: 1, number: 7, confidence: 0.2 },
        { timeSec: 2, number: 7, confidence: 0.7 },
        { timeSec: 3, number: 7 },
      ],
      0.45,
    );
    expect(kept).toHaveLength(2);
    expect(kept[0].timeSec).toBe(2);
  });

  it("scores sparse OCR as low quality", () => {
    const q = scoreTrackQuality({ detections: 1, durationSec: 90, clips: 1 });
    expect(q).toBeLessThan(0.4);
  });

  it("keeps scout clips inside a 90s media window", () => {
    const session: ScoutSession = {
      id: "s",
      matchId: "m",
      title: "long",
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      homeName: "FAV",
      awayName: "SEO",
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
          videoTimeSec: 12,
        },
        {
          id: "p2",
          setIndex: 0,
          pointIndex: 1,
          serving: "home",
          winner: "home",
          termination: "kill",
          playerNumber: 10,
          playerName: "박세린",
          videoTimeSec: 55,
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
          videoTimeSec: 88,
        },
      ],
    };
    const aligned = alignClipsToDuration(clipsFromScoutPoints(session.points, 90), 90);
    expect(aligned.length).toBe(3);
    expect(assertClipsWithinDuration(aligned, 90).ok).toBe(true);
  });
});
