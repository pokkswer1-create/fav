import { existsSync } from "node:fs";
import path from "node:path";
import type { ClipKind } from "./types";

export type OverlayServeTeam = "home" | "away" | "none";

export type HighlightScoreboard = {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  setIndex: number;
  serveTeam?: OverlayServeTeam;
};

export type HighlightOverlayPlayer = {
  number?: number | null;
  name?: string | null;
  skillLine: string;
};

export type HighlightOverlayOptions = {
  scoreboard: HighlightScoreboard;
  player: HighlightOverlayPlayer;
  hasLogo?: boolean;
  hasCourtLines?: boolean;
  fontFile?: string;
};

const DEFAULT_FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

const SKILL_EN: Record<string, string> = {
  S: "Serve",
  R: "Reception",
  A: "Attack",
  B: "Block",
  E: "Set",
  D: "Dig",
  F: "Freeball",
};

const KIND_SKILL: Record<string, string> = {
  kill: "Attack #",
  ace: "Serve #",
  block: "Block #",
  dig: "Dig -",
  error: "Error =",
  rally: "Rally -",
  custom: "Play -",
};

const COMBO_EN: Record<string, string> = {
  X5: "Quick",
  X1: "Quick",
  X2: "Quick",
  V5: "Slide",
  V1: "Slide",
  pipe: "Pipe",
  Pipe: "Pipe",
  C: "Quick",
};

/** Escape text for ffmpeg drawtext (strip raw single quotes). */
export function escapeDrawtext(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

function englishSkill(skill: string): string {
  const key = skill.trim().toUpperCase();
  return SKILL_EN[key] ?? (skill.trim() || "Play");
}

function englishCombo(combo: string): string {
  const t = combo.trim();
  return COMBO_EN[t] ?? t;
}

/** Parse labels like `#7 A# X5` or `A+`. */
export function parseSkillFromLabel(label: string): {
  skill?: string;
  effect?: string;
  combination?: string;
} {
  const raw = label.trim();
  const m = raw.match(/(?:#\d+\s+)?([SRADEBF])([#+\-!/=])(?:\s+([A-Za-z0-9]+))?/i);
  if (!m) return {};
  return { skill: m[1].toUpperCase(), effect: m[2], combination: m[3] };
}

export function formatOverlaySkillLine(input: {
  skill?: string | null;
  effect?: string | null;
  combination?: string | null;
  kind?: ClipKind | string | null;
  label?: string | null;
  fallbackLabel?: string | null;
}): string {
  let skill = (input.skill ?? "").trim();
  let effect = (input.effect ?? "").trim();
  let combo = (input.combination ?? "").trim();

  if (!skill && input.label) {
    const parsed = parseSkillFromLabel(input.label);
    skill = parsed.skill ?? "";
    effect = effect || (parsed.effect ?? "");
    combo = combo || (parsed.combination ?? "");
  }

  if (!skill && !effect && !combo && input.kind) {
    return KIND_SKILL[input.kind] ?? "Play -";
  }

  if (!skill && !effect && !combo) {
    return (input.fallbackLabel ?? input.label ?? "Play").trim() || "Play";
  }

  const skillWord = englishSkill(skill || "A");
  const comboWord = combo ? englishCombo(combo) : "";

  if (comboWord && effect) return `${skillWord} ${comboWord} ${effect}`;
  if (comboWord) return `${skillWord} ${comboWord}`;
  if (effect) return `${skillWord} ${effect}`;
  return `${skillWord} -`;
}

export function resolveOverlayFont(preferred?: string): string {
  if (preferred && existsSync(preferred)) return preferred;
  for (const candidate of DEFAULT_FONT_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return preferred || DEFAULT_FONT_CANDIDATES[0];
}

export function buildTitleCardDrawtext(params: {
  homeName: string;
  awayName: string;
  subtitle?: string;
  fontFile?: string;
}): string {
  const font = escapeDrawtext(resolveOverlayFont(params.fontFile));
  const title = escapeDrawtext(`${params.homeName} vs ${params.awayName}`);
  const filters = [
    `drawtext=fontfile='${font}':text='${title}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-28:box=1:boxcolor=black@0.45:boxborderw=18`,
  ];
  const subtitle = (params.subtitle ?? "Total Analysis").trim();
  if (subtitle) {
    filters.push(
      `drawtext=fontfile='${font}':text='${escapeDrawtext(subtitle)}':fontsize=28:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+42:box=1:boxcolor=black@0.35:boxborderw=12`,
    );
  }
  return filters.join(",");
}

/**
 * DataVolley-style overlay graph.
 * Inputs: [0:v]=clip, [1:v]=logo, [2:v]=court lines (optional).
 */
export function buildHighlightOverlayFilterComplex(
  options: HighlightOverlayOptions,
): string {
  const font = escapeDrawtext(resolveOverlayFont(options.fontFile));
  const score = options.scoreboard;
  const player = options.player;
  const showLogo = options.hasLogo !== false;
  const showCourtLines = options.hasCourtLines !== false;
  const serve = score.serveTeam ?? "none";

  const homeLine = escapeDrawtext(
    `${score.homeName}  ${score.homeScore}${serve === "home" ? " *" : ""}`,
  );
  const awayLine = escapeDrawtext(
    `${score.awayName}  ${score.awayScore}${serve === "away" ? " *" : ""}`,
  );
  const setLine = escapeDrawtext(`SET ${score.setIndex}`);
  const numberText = escapeDrawtext(
    player.number != null ? String(player.number) : "-",
  );
  const nameText = escapeDrawtext(player.name?.trim() || "Player");
  const skillText = escapeDrawtext(player.skillLine || "Play -");

  const parts: string[] = [];
  let v = "[0:v]";

  if (showCourtLines) {
    parts.push(`${v}[2:v]overlay=0:0:format=auto[vlines]`);
    v = "[vlines]";
  }

  parts.push(
    `${v}drawbox=x=24:y=24:w=320:h=118:color=black@0.55:t=fill,` +
      `drawtext=fontfile='${font}':text='${setLine}':fontsize=18:fontcolor=white:x=40:y=32,` +
      `drawtext=fontfile='${font}':text='${homeLine}':fontsize=26:fontcolor=white:x=40:y=58,` +
      `drawtext=fontfile='${font}':text='${awayLine}':fontsize=26:fontcolor=white:x=40:y=92[vscore]`,
  );
  v = "[vscore]";

  parts.push(
    `${v}drawbox=x=24:y=h-110:w=420:h=86:color=black@0.62:t=fill,` +
      `drawbox=x=24:y=h-110:w=70:h=86:color=0xE6007E@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='${numberText}':fontsize=36:fontcolor=white:x=36:y=h-78,` +
      `drawtext=fontfile='${font}':text='${nameText}':fontsize=28:fontcolor=white:x=110:y=h-96,` +
      `drawtext=fontfile='${font}':text='${skillText}':fontsize=22:fontcolor=white:x=110:y=h-58[vbanner]`,
  );
  v = "[vbanner]";

  if (showLogo) {
    parts.push(`[1:v]scale=72:-1[logo]`, `${v}[logo]overlay=W-w-20:20:format=auto[vout]`);
  } else {
    parts.push(`${v}null[vout]`);
  }

  return parts.join(";");
}

export function defaultOverlayAssetPaths(cwd = process.cwd()) {
  return {
    logoPath: path.join(cwd, "public", "fav-wing-logo.png"),
    courtLinesPath: path.join(cwd, "public", "overlay-court-lines.png"),
  };
}

export type HighlightMatchOverlay = {
  homeName: string;
  awayName: string;
  includeTitleCard?: boolean;
  titleSubtitle?: string;
  showCourtLines?: boolean;
  showLogo?: boolean;
};

export function overlayOptionsForClip(
  clip: {
    kind: ClipKind | string;
    label?: string;
    playerName?: string;
    playerNumber?: number;
    skill?: string;
    effect?: string;
    combination?: string;
    skillLine?: string;
    homeScore?: number;
    awayScore?: number;
    setIndex?: number;
    serveTeam?: OverlayServeTeam;
  },
  match: HighlightMatchOverlay,
): HighlightOverlayOptions {
  const skillLine =
    clip.skillLine?.trim() ||
    formatOverlaySkillLine({
      skill: clip.skill,
      effect: clip.effect,
      combination: clip.combination,
      kind: clip.kind,
      label: clip.label,
    });

  return {
    scoreboard: {
      homeName: match.homeName,
      awayName: match.awayName,
      homeScore: clip.homeScore ?? 0,
      awayScore: clip.awayScore ?? 0,
      setIndex: (clip.setIndex ?? 0) + 1,
      serveTeam: clip.serveTeam ?? "none",
    },
    player: {
      number: clip.playerNumber,
      name: clip.playerName,
      skillLine,
    },
    hasLogo: match.showLogo !== false,
    hasCourtLines: match.showCourtLines !== false,
  };
}
