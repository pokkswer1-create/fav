import { createDetectableSampleVideo, detectHighlightCandidates } from "../src/lib/scene-detect";

async function main() {
  await createDetectableSampleVideo("/tmp/test-detect.mp4");
  const r = await detectHighlightCandidates("/tmp/test-detect.mp4");
  console.log(
    JSON.stringify(
      {
        method: r.method,
        peaks: r.peaks.length,
        clips: r.clips.map((c) => [c.startSec, c.endSec, c.kind]),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
