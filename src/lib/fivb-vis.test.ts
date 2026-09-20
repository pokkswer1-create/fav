import { describe, expect, it } from "vitest";
import { parseTournamentListXml } from "./fivb-vis";

describe("fivb-vis", () => {
  it("parses tournament list xml", () => {
    const xml = `<VolleyballTournaments NbItems="2"><VolleyballTournament No="10" Name="VNL 2025 - MEN" Code="VNL2025M" StartDate="2025-06-01" EndDate="2025-07-01"/><VolleyballTournament No="11" Name="World Cup" Code="WC" StartDate="2023-01-01" EndDate=""/></VolleyballTournaments>`;
    const list = parseTournamentListXml(xml);
    expect(list).toHaveLength(2);
    expect(list[0].name).toContain("VNL");
  });
});
