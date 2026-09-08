import { describe, expect, it } from "vitest";
import {
  analyzeMatch,
  attackEfficiency,
  killRate,
  ratePlayer,
  scoreLabel,
} from "./analysis";
import { demoMatch } from "./demo-match";

describe("volleyball power analysis", () => {
  it("computes attack efficiency", () => {
    expect(attackEfficiency({ kills: 10, attackErrors: 2, attacks: 20 })).toBe(0.4);
    expect(attackEfficiency({ kills: 0, attackErrors: 0, attacks: 0 })).toBe(0);
  });

  it("computes kill rate", () => {
    expect(killRate({ kills: 8, attacks: 20 })).toBe(0.4);
  });

  it("rates a strong opposite highly", () => {
    const rating = ratePlayer({
      id: "p1",
      name: "Ace",
      number: 10,
      position: "OPP",
      attacks: 30,
      kills: 16,
      attackErrors: 3,
      blocks: 2,
      digs: 5,
      aces: 3,
      serveErrors: 1,
      receptions: 0,
      receptionErrors: 0,
      sets: 0,
      setErrors: 0,
    });
    expect(rating.overall).toBeGreaterThan(70);
    expect(rating.tags).toContain("고효율 공격");
  });

  it("analyzes demo match with FAV advantage notes", () => {
    const report = analyzeMatch(demoMatch);
    expect(report.setScore).toBe("3-1");
    expect(report.home.isFav).toBe(true);
    expect(report.home.overall).toBeGreaterThan(report.away.overall);
    expect(report.home.keyPlayers.length).toBe(3);
    expect(report.matchupNotes.length).toBeGreaterThan(0);
    expect(report.coachingPlan.length).toBeGreaterThan(0);
    expect(report.highlightSuggestions.some((h) => h.kind === "kill")).toBe(true);
    expect(scoreLabel(report.home.overall)).toMatch(/^[SABCD]$/);
  });
});
