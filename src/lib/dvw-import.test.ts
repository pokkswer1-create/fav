import { describe, expect, it } from "vitest";
import { buildDvwExport } from "./dvw-export";
import { parseDvwText, parseFavDvw } from "./dvw-import";

describe("dvw import", () => {
  it("round-trips FAV DVW export", () => {
    const text = buildDvwExport({
      homeName: "FAV",
      awayName: "SEOUL",
      date: "2026-03-21",
      actions: [
        {
          id: "1",
          setIndex: 0,
          rallyIndex: 0,
          team: "home",
          skill: "A",
          effect: "#",
          playerNumber: 7,
          videoTimeSec: 12.5,
          pointEnding: true,
        },
        {
          id: "2",
          setIndex: 0,
          rallyIndex: 1,
          team: "away",
          skill: "S",
          effect: "+",
          playerNumber: 10,
          videoTimeSec: 20,
        },
      ],
    });
    const parsed = parseFavDvw(text);
    expect(parsed?.homeName).toBe("FAV");
    expect(parsed?.actions).toHaveLength(2);
    expect(parsed?.actions[0]).toMatchObject({
      skill: "A",
      effect: "#",
      playerNumber: 7,
      videoTimeSec: 12.5,
    });
    expect(parsed?.points.length).toBeGreaterThanOrEqual(1);
  });

  it("parses classic scout code lines", () => {
    const text = `[3TEAMS]
17;University of Louisville;3;;;;
42;University of Dayton;0;;;;
[3SCOUT]
*15AT=X6~29AH4~+6F;;;;4480;-1-1;7207;;1;6;5;1;770;;
a10AH#;;;;1200;-1-1;;;1;6;5;1;771;;
`;
    const parsed = parseDvwText(text);
    expect(parsed.engine).toBe("dvw-scout");
    expect(parsed.homeName).toContain("Louisville");
    expect(parsed.actions.length).toBeGreaterThanOrEqual(2);
    expect(parsed.actions.some((a) => a.playerNumber === 15 && a.skill === "A")).toBe(true);
  });
});
