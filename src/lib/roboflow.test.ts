import { describe, expect, it } from "vitest";
import { parseRoboflowPredictions } from "./roboflow";

describe("parseRoboflowPredictions", () => {
  it("extracts jersey numbers and normalizes boxes", () => {
    const raw = {
      image: { width: 100, height: 200 },
      predictions: [
        { class: "7", confidence: 0.9, x: 50, y: 100, width: 20, height: 40 },
        { class: "player-10", confidence: 0.8, x: 10, y: 20, width: 10, height: 10 },
        { class: "ball", confidence: 0.99, x: 1, y: 1, width: 1, height: 1 },
      ],
    };
    const hits = parseRoboflowPredictions(raw, 12.5, 7);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      timeSec: 12.5,
      number: 7,
      confidence: 0.9,
      xNorm: 0.5,
      yNorm: 0.5,
    });
  });
});
