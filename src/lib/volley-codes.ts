/**
 * DataVolley / VolleyStation–style coding primitives.
 * Skills, quality grades, court zones, efficiency — the core of pro scouting.
 */

export type VolleySkill = "S" | "R" | "A" | "B" | "E" | "D" | "F";
/** DataVolley quality ladder */
export type VolleyEffect = "#" | "+" | "!" | "-" | "/" | "=";

/** Court zones 1–9 (DataVolley numbering). */
export type CourtZone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Setter court position = rotation label P1–P6 */
export type RotationId = 1 | 2 | 3 | 4 | 5 | 6;

export const SKILL_LABELS: Record<VolleySkill, string> = {
  S: "서브",
  R: "리시브",
  A: "공격",
  B: "블로킹",
  E: "세트",
  D: "디그",
  F: "프리볼",
};

export const EFFECT_LABELS: Record<VolleyEffect, string> = {
  "#": "킬/에이스(#)",
  "+": "플러스(+)",
  "!": "보통(!)",
  "-": "마이너스(-)",
  "/": "오버패스(/)",
  "=": "범실(=)",
};

export const ZONE_LABELS: Record<CourtZone, string> = {
  1: "우후(1)",
  2: "우전(2)",
  3: "중전(3)",
  4: "좌전(4)",
  5: "좌후(5)",
  6: "중후(6)",
  7: "좌중(7)",
  8: "중중(8)",
  9: "우중(9)",
};

/** Weights used by VSEFF-style efficiency (common DV convention). */
const EFFECT_WEIGHT: Record<VolleyEffect, number> = {
  "#": 1,
  "+": 0.5,
  "!": 0,
  "-": -0.5,
  "/": 0,
  "=": -1,
};

export interface CodedAction {
  id: string;
  setIndex: number;
  rallyIndex: number;
  team: "home" | "away";
  skill: VolleySkill;
  effect: VolleyEffect;
  playerNumber?: number;
  playerName?: string;
  startZone?: CourtZone;
  endZone?: CourtZone;
  rotation?: RotationId;
  /** Setter call / combination (e.g. X5, V5, pipe) */
  combination?: string;
  videoTimeSec?: number;
  /** Point-ending action */
  pointEnding?: boolean;
}

export function skillEfficiency(actions: CodedAction[], skill?: VolleySkill): number {
  const list = skill ? actions.filter((a) => a.skill === skill) : actions;
  if (list.length === 0) return 0;
  const sum = list.reduce((s, a) => s + EFFECT_WEIGHT[a.effect], 0);
  return sum / list.length;
}

export function skillCount(
  actions: CodedAction[],
  skill: VolleySkill,
  effect?: VolleyEffect,
): number {
  return actions.filter((a) => a.skill === skill && (effect == null || a.effect === effect)).length;
}

export function skillPercent(
  actions: CodedAction[],
  skill: VolleySkill,
  effect: VolleyEffect,
): number {
  const total = skillCount(actions, skill);
  if (total === 0) return 0;
  return skillCount(actions, skill, effect) / total;
}

/** Side-out = reception team wins the rally; break point = serving team wins. */
export function isSideOutPoint(serving: "home" | "away", winner: "home" | "away"): boolean {
  return serving !== winner;
}

export interface RotationBucket {
  rotation: RotationId;
  sideOutAttempts: number;
  sideOutWins: number;
  breakAttempts: number;
  breakWins: number;
  sideOutRate: number;
  breakRate: number;
}

export function analyzeRotations(
  points: Array<{
    serving: "home" | "away";
    winner: "home" | "away";
    homeRotation?: RotationId;
    awayRotation?: RotationId;
  }>,
  side: "home" | "away" = "home",
): RotationBucket[] {
  const buckets = new Map<RotationId, RotationBucket>();
  for (let r = 1; r <= 6; r += 1) {
    buckets.set(r as RotationId, {
      rotation: r as RotationId,
      sideOutAttempts: 0,
      sideOutWins: 0,
      breakAttempts: 0,
      breakWins: 0,
      sideOutRate: 0,
      breakRate: 0,
    });
  }

  for (const p of points) {
    const rot = side === "home" ? p.homeRotation : p.awayRotation;
    if (!rot) continue;
    const b = buckets.get(rot)!;
    const weServe = p.serving === side;
    const weWin = p.winner === side;
    if (weServe) {
      b.breakAttempts += 1;
      if (weWin) b.breakWins += 1;
    } else {
      b.sideOutAttempts += 1;
      if (weWin) b.sideOutWins += 1;
    }
  }

  for (const b of buckets.values()) {
    b.sideOutRate = b.sideOutAttempts ? b.sideOutWins / b.sideOutAttempts : 0;
    b.breakRate = b.breakAttempts ? b.breakWins / b.breakAttempts : 0;
  }
  return [...buckets.values()];
}

export interface SetterDistributionRow {
  combination: string;
  attempts: number;
  kills: number;
  errors: number;
  efficiency: number;
}

export function setterDistribution(actions: CodedAction[]): SetterDistributionRow[] {
  const attacks = actions.filter((a) => a.skill === "A" && a.combination);
  const map = new Map<string, CodedAction[]>();
  for (const a of attacks) {
    const key = a.combination || "?";
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([combination, list]) => {
      const kills = list.filter((a) => a.effect === "#").length;
      const errors = list.filter((a) => a.effect === "=").length;
      return {
        combination,
        attempts: list.length,
        kills,
        errors,
        efficiency: skillEfficiency(list),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
}

/** Zone attack heatmap counts from endZone of attacks. */
export function attackZoneCounts(actions: CodedAction[]): Record<CourtZone, number> {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 } as Record<CourtZone, number>;
  for (const a of actions) {
    if (a.skill === "A" && a.endZone) out[a.endZone] += 1;
  }
  return out;
}

export function effectToTermination(
  skill: VolleySkill,
  effect: VolleyEffect,
  ourTeamWon: boolean,
): "kill" | "ace" | "block" | "opponent_error" | "our_error" | "other" {
  if (effect === "#" && skill === "A") return "kill";
  if (effect === "#" && skill === "S") return "ace";
  if (effect === "#" && skill === "B") return "block";
  if (effect === "=") return ourTeamWon ? "opponent_error" : "our_error";
  return "other";
}

export function nextRotation(current: RotationId, wonByServingTeam: boolean): RotationId {
  // Only receiving team rotates after winning the rally (FIVB side-out).
  if (!wonByServingTeam) {
    return (((current % 6) + 1) as RotationId);
  }
  return current;
}

export const COMMON_COMBOS = ["X5", "X6", "X1", "X2", "V5", "V6", "Pipe", "C", "Slide"] as const;
