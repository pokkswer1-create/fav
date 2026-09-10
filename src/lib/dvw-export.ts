import type { CodedAction, VolleyEffect, VolleySkill } from "./volley-codes";
import { SKILL_LABELS } from "./volley-codes";

/**
 * Minimal DataVolley-compatible text export.
 * Enough for interchange / archival — not a full DVW round-trip of every DV4 field.
 */
export function buildDvwExport(opts: {
  homeName: string;
  awayName: string;
  date: string;
  actions: CodedAction[];
}): string {
  const lines: string[] = [];
  lines.push("[3DATAVOLLEY]");
  lines.push("FILEFORMAT=2.0");
  lines.push(`GENERATOR=FAV Scout`);
  lines.push(`DATE=${opts.date}`);
  lines.push("[3TEAMS]");
  lines.push(`HOME=${opts.homeName}`);
  lines.push(`AWAY=${opts.awayName}`);
  lines.push("[3ACTIONS]");
  for (const a of opts.actions) {
    const team = a.team === "home" ? "a" : "*";
    const num = a.playerNumber != null ? String(a.playerNumber) : "0";
    const zones =
      a.startZone || a.endZone
        ? `${a.startZone ?? ""}:${a.endZone ?? ""}`
        : "";
    const combo = a.combination ? `~${a.combination}` : "";
    const rot = a.rotation != null ? `@P${a.rotation}` : "";
    const t = a.videoTimeSec != null ? `T${a.videoTimeSec.toFixed(1)}` : "";
    lines.push(`${team}${num}${a.skill}${a.effect}${zones}${combo}${rot}${t}`);
  }
  lines.push("[3END]");
  return lines.join("\n");
}

export function downloadDvw(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".dvw") ? filename : `${filename}.dvw`;
  a.click();
  URL.revokeObjectURL(url);
}

export function describeAction(a: CodedAction): string {
  const skill = SKILL_LABELS[a.skill as VolleySkill] ?? a.skill;
  return `#${a.playerNumber ?? "-"} ${skill}${a.effect as VolleyEffect}${
    a.combination ? ` ${a.combination}` : ""
  }`;
}
