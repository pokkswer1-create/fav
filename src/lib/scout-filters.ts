import type { ClipKind, VideoClipMarker } from "./types";
import type { CodedAction, VolleyEffect, VolleySkill } from "./volley-codes";
import { alignClipsToDuration } from "./clip-align";

export interface ActionFilter {
  skill?: VolleySkill;
  effect?: VolleyEffect;
  playerNumber?: number;
  rotation?: number;
  combination?: string;
  team?: "home" | "away";
  durationSec: number;
  padSec?: number;
}

function skillToClipKind(skill: VolleySkill, effect: VolleyEffect): ClipKind {
  if (skill === "A" && effect === "#") return "kill";
  if (skill === "S" && effect === "#") return "ace";
  if (skill === "B" && effect === "#") return "block";
  if (skill === "D") return "dig";
  if (effect === "=") return "error";
  return "rally";
}

/** VolleyStation-style: filter coded actions → video clips (One-action / playlist). */
export function filterActionsToClips(
  actions: CodedAction[],
  filter: ActionFilter,
): VideoClipMarker[] {
  const pad = filter.padSec ?? 1.2;
  const matched = actions.filter((a) => {
    if (typeof a.videoTimeSec !== "number") return false;
    if (filter.skill && a.skill !== filter.skill) return false;
    if (filter.effect && a.effect !== filter.effect) return false;
    if (filter.playerNumber != null && a.playerNumber !== filter.playerNumber) return false;
    if (filter.rotation != null && a.rotation !== filter.rotation) return false;
    if (filter.combination && a.combination !== filter.combination) return false;
    if (filter.team && a.team !== filter.team) return false;
    return true;
  });

  const raw: VideoClipMarker[] = matched.map((a, i) => {
    const t = a.videoTimeSec!;
    return {
      id: `act-${a.id}-${i}`,
      startSec: Math.max(0, t - pad),
      endSec: Math.min(filter.durationSec, t + pad * 0.6),
      kind: skillToClipKind(a.skill, a.effect),
      label: `#${a.playerNumber ?? "-"} ${a.skill}${a.effect}${a.combination ? ` ${a.combination}` : ""}`,
      playerNumber: a.playerNumber,
      playerName: a.playerName,
    };
  });

  return alignClipsToDuration(raw, filter.durationSec);
}
