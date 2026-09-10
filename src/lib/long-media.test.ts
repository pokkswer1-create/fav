import { describe, expect, it } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createDetectableSampleVideo, detectHighlightCandidates } from "./scene-detect";
import { trackPlayerInVideo } from "./player-track";
import { renderHighlightReel } from "./video";
import { alignClipsToDuration, assertClipsWithinDuration } from "./clip-align";
import { clipsFromScoutPoints } from "./scout";
import { removePath } from "./media-validate";

const runLong = process.env.FAV_LONG_MEDIA === "1";

describe.runIf(runLong)("long media realism (90s)", () => {
  it(
    "detects, tracks, and renders scout cuts without misalignment",
    async () => {
      const out = path.join("/tmp", `fav-long-${Date.now()}.mp4`);
      try {
        await createDetectableSampleVideo(out, { durationSec: 90 });
        const detect = await detectHighlightCandidates(out);
        expect(detect.durationSec).toBeGreaterThan(85);
        expect(
          assertClipsWithinDuration(alignClipsToDuration(detect.clips, detect.durationSec), detect.durationSec)
            .ok,
        ).toBe(true);

        const track = await trackPlayerInVideo({
          videoPath: out,
          player: {
            id: "h7",
            name: "김하늘",
            number: 7,
            kills: 2,
            aces: 1,
            blocks: 0,
            digs: 1,
          },
          intervalSec: 1.2,
        });
        expect(track.clips.length).toBeGreaterThan(0);
        expect(assertClipsWithinDuration(track.clips, track.durationSec).ok).toBe(true);
        expect(track.quality).toBeGreaterThan(0);

        const scoutClips = alignClipsToDuration(
          clipsFromScoutPoints(
            [
              {
                id: "p1",
                setIndex: 0,
                pointIndex: 0,
                serving: "home",
                winner: "home",
                termination: "ace",
                playerNumber: 7,
                playerName: "김하늘",
                videoTimeSec: 10,
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
                videoTimeSec: 40,
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
                videoTimeSec: 75,
              },
            ],
            90,
          ),
          90,
        );
        const rendered = await renderHighlightReel(out, scoutClips);
        const stat = await fs.stat(rendered.outputPath);
        expect(rendered.clipCount).toBeGreaterThan(0);
        expect(stat.size).toBeGreaterThan(1000);
        await removePath(rendered.workDir);
      } finally {
        await removePath(out);
      }
    },
    180_000,
  );
});
