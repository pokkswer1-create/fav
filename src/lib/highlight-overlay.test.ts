import { describe, expect, it } from "vitest";
import {
  buildHighlightOverlayFilterComplex,
  buildTitleCardDrawtext,
  escapeDrawtext,
  formatOverlaySkillLine,
  overlayOptionsForClip,
  parseSkillFromLabel,
} from "./highlight-overlay";

describe("highlight overlay helpers", () => {
  it("escapes ffmpeg drawtext special chars", () => {
    expect(escapeDrawtext("FAV:김하늘")).toContain("\\:");
    expect(escapeDrawtext("It's")).not.toContain("'");
  });

  it("formats DataVolley-style skill lines", () => {
    expect(formatOverlaySkillLine({ skill: "R", effect: "-" })).toBe("Reception -");
    expect(formatOverlaySkillLine({ skill: "A", effect: "#", combination: "Quick" })).toBe(
      "Attack Quick #",
    );
    expect(formatOverlaySkillLine({ kind: "kill" })).toBe("Attack #");
    expect(formatOverlaySkillLine({ label: "#7 A# X5" })).toMatch(/Attack/);
  });

  it("parses coded labels", () => {
    expect(parseSkillFromLabel("#7 A# X5")).toEqual({
      skill: "A",
      effect: "#",
      combination: "X5",
    });
  });

  it("builds filter_complex with scoreboard, banner, logo and court lines", () => {
    const graph = buildHighlightOverlayFilterComplex({
      scoreboard: {
        homeName: "FAV",
        awayName: "서울",
        homeScore: 12,
        awayScore: 10,
        setIndex: 2,
        serveTeam: "home",
      },
      player: { number: 7, name: "김하늘", skillLine: "Attack Quick #" },
      hasLogo: true,
      hasCourtLines: true,
    });
    expect(graph).toContain("drawbox");
    expect(graph).toContain("drawtext");
    expect(graph).toContain("김하늘");
    expect(graph).toContain("Attack Quick #");
    expect(graph).toContain("overlay=W-w-20:20");
    expect(graph).toContain("[vout]");
    expect(graph).toContain("[2:v]overlay");
  });

  it("builds Total Analysis title card text filters", () => {
    const t = buildTitleCardDrawtext({
      homeName: "FAV",
      awayName: "서울 윙스",
      subtitle: "Total Analysis",
    });
    expect(t).toContain("Total Analysis");
    expect(t).toContain("FAV vs");
  });

  it("maps clip + match meta into overlay options", () => {
    const opts = overlayOptionsForClip(
      {
        kind: "kill",
        label: "#7 A# X5",
        playerName: "김하늘",
        playerNumber: 7,
        homeScore: 12,
        awayScore: 10,
        setIndex: 1,
        serveTeam: "home",
      },
      { homeName: "FAV", awayName: "서울 윙스" },
    );
    expect(opts.scoreboard.setIndex).toBe(2);
    expect(opts.player.skillLine).toMatch(/Attack/);
    expect(opts.hasLogo).toBe(true);
  });
});
