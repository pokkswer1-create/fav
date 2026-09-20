import type { CodedAction, CourtZone, RotationId, VolleyEffect, VolleySkill } from "./volley-codes";
import type { ScoutPoint, ScoutSession } from "./scout";

const SKILLS = new Set(["S", "R", "A", "B", "E", "D", "F"]);
const EFFECTS = new Set(["#", "+", "!", "-", "/", "="]);

export interface DvwImportResult {
  homeName: string;
  awayName: string;
  date: string;
  actions: CodedAction[];
  points: ScoutPoint[];
  engine: "fav-text" | "dvw-scout";
  notes: string[];
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Parse FAV Scout minimal DVW export ([3ACTIONS] lines). */
export function parseFavDvw(text: string): DvwImportResult | null {
  if (!text.includes("[3ACTIONS]") && !text.includes("[3DATAVOLLEY]")) return null;
  if (!text.includes("[3ACTIONS]")) return null;
  const notes: string[] = [];
  let homeName = "HOME";
  let awayName = "AWAY";
  let date = new Date().toISOString().slice(0, 10);
  const home = text.match(/^HOME=(.+)$/m);
  const away = text.match(/^AWAY=(.+)$/m);
  const dateM = text.match(/^DATE=(.+)$/m);
  if (home) homeName = home[1].trim();
  if (away) awayName = away[1].trim();
  if (dateM) date = dateM[1].trim();

  const section = text.split("[3ACTIONS]")[1]?.split("[3END]")[0] ?? "";
  const actions: CodedAction[] = [];
  for (const raw of section.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // a7A#T12.5 or *10S+@P1T3.0
    const m = line.match(/^([a*])(\d{0,2})([SRABEDF])([#+\-!/=])(.*)$/);
    if (!m) continue;
    const team = m[1] === "a" ? "home" : "away";
    const playerNumber = m[2] ? Number(m[2]) : undefined;
    const skill = m[3] as VolleySkill;
    const effect = m[4] as VolleyEffect;
    const rest = m[5] ?? "";
    const zones = rest.match(/(\d):(\d)/);
    const combo = rest.match(/~([A-Za-z0-9]+)/);
    const rot = rest.match(/@P([1-6])/);
    const t = rest.match(/T(\d+(?:\.\d+)?)/);
    actions.push({
      id: newId("act"),
      setIndex: 0,
      rallyIndex: actions.length,
      team,
      skill,
      effect,
      playerNumber,
      startZone: zones ? (Number(zones[1]) as CourtZone) : undefined,
      endZone: zones ? (Number(zones[2]) as CourtZone) : undefined,
      combination: combo?.[1],
      rotation: rot ? (Number(rot[1]) as RotationId) : undefined,
      videoTimeSec: t ? Number(t[1]) : undefined,
      pointEnding: effect === "#" || effect === "=",
    });
  }
  notes.push(`FAV DVW 액션 ${actions.length}개`);
  return {
    homeName,
    awayName,
    date,
    actions,
    points: actionsToPoints(actions),
    engine: "fav-text",
    notes,
  };
}

/**
 * Parse classic DataVolley scout codes (subset) from [3SCOUT] / raw scout body.
 * Example code token: *15AT=X6 or a10AH#
 */
export function parseClassicScoutCodes(text: string): DvwImportResult {
  const notes: string[] = [];
  let homeName = "HOME";
  let awayName = "AWAY";
  const teams = text.match(/\[3TEAMS\]\s*\n([^\n]+)\n([^\n]+)/);
  if (teams) {
    homeName = teams[1].split(";")[1]?.trim() || homeName;
    awayName = teams[2].split(";")[1]?.trim() || awayName;
  }
  const dateM = text.match(/\[3MATCH\]\s*\n([^;]+)/);
  const date = dateM?.[1]?.trim().replace(/\//g, "-") || new Date().toISOString().slice(0, 10);

  // Scout rows often start after [3SCOUT] or are semicolon-delimited with a leading code
  const body = text.includes("[3SCOUT]")
    ? text.split("[3SCOUT]")[1]
    : text;
  const actions: CodedAction[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const code = raw.split(";")[0]?.trim() ?? "";
    // *15AT=X6…  or a07SM#  or *05A#
    const m = code.match(/^([a*])(\d{1,2})([SRABEDF])(.*)$/i);
    if (!m) continue;
    const skill = m[3].toUpperCase() as VolleySkill;
    if (!SKILLS.has(skill)) continue;
    const rest = m[4] ?? "";
    const effectChar = [...rest].find((ch) => EFFECTS.has(ch));
    if (!effectChar) continue;
    const effect = effectChar as VolleyEffect;
    // video clock sometimes in later fields as 4-digit centiseconds
    const fields = raw.split(";");
    let videoTimeSec: number | undefined;
    for (const f of fields.slice(1, 6)) {
      if (/^\d{4}$/.test(f)) {
        const cs = Number(f);
        if (cs > 0) {
          videoTimeSec = cs / 100;
          break;
        }
      }
    }
    actions.push({
      id: newId("act"),
      setIndex: 0,
      rallyIndex: actions.length,
      team: m[1] === "a" ? "home" : "away",
      skill,
      effect,
      playerNumber: Number(m[2]),
      videoTimeSec,
      pointEnding: effect === "#" || effect === "=",
    });
  }
  notes.push(`DataVolley 스카우트 코드 ${actions.length}개 파싱`);
  return {
    homeName,
    awayName,
    date,
    actions,
    points: actionsToPoints(actions),
    engine: "dvw-scout",
    notes,
  };
}

export function parseDvwText(text: string): DvwImportResult {
  const fav = parseFavDvw(text);
  if (fav && fav.actions.length > 0) return fav;
  return parseClassicScoutCodes(text);
}

function actionsToPoints(actions: CodedAction[]): ScoutPoint[] {
  const points: ScoutPoint[] = [];
  let pointIndex = 0;
  for (const a of actions) {
    if (!a.pointEnding) continue;
    const winner =
      a.effect === "#"
        ? a.team
        : a.effect === "="
          ? a.team === "home"
            ? "away"
            : "home"
          : a.team;
    const termination =
      a.skill === "A" && a.effect === "#"
        ? "kill"
        : a.skill === "S" && a.effect === "#"
          ? "ace"
          : a.skill === "B" && a.effect === "#"
            ? "block"
            : a.effect === "="
              ? a.team === "home"
                ? "our_error"
                : "opponent_error"
              : "other";
    points.push({
      id: newId("pt"),
      setIndex: a.setIndex,
      pointIndex: pointIndex++,
      serving: a.team,
      winner,
      termination,
      playerNumber: a.playerNumber,
      playerName: a.playerName,
      videoTimeSec: a.videoTimeSec,
      endSkill: a.skill,
      endEffect: a.effect,
      endZone: a.endZone,
      combination: a.combination,
    });
  }
  return points;
}

export function dvwToScoutSession(imported: DvwImportResult, matchId = "dvw-import"): ScoutSession {
  const now = new Date().toISOString();
  return {
    id: newId("scout"),
    matchId,
    title: `${imported.homeName} vs ${imported.awayName} (DVW)`,
    createdAt: now,
    updatedAt: now,
    homeName: imported.homeName,
    awayName: imported.awayName,
    points: imported.points,
    actions: imported.actions,
  };
}
