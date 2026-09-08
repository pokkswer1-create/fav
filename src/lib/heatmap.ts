import type { ClipKind, PlayerStats, Position, TeamInput, TeamPower } from "./types";

/** Volleyball half-court zones (attacking team's perspective). */
export type CourtZoneId =
  | "LF" // left front (4)
  | "MF" // middle front (3)
  | "RF" // right front (2)
  | "LB" // left back (5)
  | "MB" // middle back (6)
  | "RB"; // right back (1)

export interface CourtZoneHeat {
  id: CourtZoneId;
  label: string;
  /** 0..1 intensity */
  value: number;
  breakdown: {
    attack: number;
    block: number;
    dig: number;
    serve: number;
    reception: number;
  };
}

export interface TeamHeatmap {
  teamName: string;
  isFav: boolean;
  zones: CourtZoneHeat[];
  hotZones: CourtZoneId[];
  coldZones: CourtZoneId[];
}

const ZONE_META: Record<CourtZoneId, { label: string; row: 0 | 1; col: 0 | 1 | 2 }> = {
  LF: { label: "좌전(4)", row: 0, col: 0 },
  MF: { label: "중전(3)", row: 0, col: 1 },
  RF: { label: "우전(2)", row: 0, col: 2 },
  LB: { label: "좌후(5)", row: 1, col: 0 },
  MB: { label: "중후(6)", row: 1, col: 1 },
  RB: { label: "우후(1)", row: 1, col: 2 },
};

const POSITION_WEIGHTS: Record<
  Position,
  Partial<Record<CourtZoneId, { attack?: number; block?: number; dig?: number; serve?: number; reception?: number }>>
> = {
  OH: {
    LF: { attack: 0.55, dig: 0.25, reception: 0.35, serve: 0.3 },
    LB: { dig: 0.35, reception: 0.4, serve: 0.25 },
    MF: { attack: 0.15 },
    RB: { dig: 0.1 },
  },
  OPP: {
    RF: { attack: 0.6, block: 0.15, serve: 0.35 },
    RB: { dig: 0.2, serve: 0.25 },
    MF: { attack: 0.2, block: 0.1 },
  },
  MB: {
    MF: { attack: 0.55, block: 0.55 },
    LF: { block: 0.2, attack: 0.15 },
    RF: { block: 0.2, attack: 0.15 },
  },
  S: {
    MF: { attack: 0.2 },
    MB: { dig: 0.25, serve: 0.3 },
    RF: { dig: 0.15 },
    LF: { dig: 0.15 },
  },
  L: {
    LB: { dig: 0.4, reception: 0.45 },
    MB: { dig: 0.35, reception: 0.35 },
    RB: { dig: 0.25, reception: 0.2 },
  },
  U: {
    MF: { attack: 0.2, block: 0.2 },
    MB: { dig: 0.2, reception: 0.2, serve: 0.2 },
  },
};

function emptyBreakdown() {
  return { attack: 0, block: 0, dig: 0, serve: 0, reception: 0 };
}

function accumulatePlayer(
  zones: Record<CourtZoneId, ReturnType<typeof emptyBreakdown>>,
  player: PlayerStats,
) {
  const weights = POSITION_WEIGHTS[player.position] ?? POSITION_WEIGHTS.U;
  for (const [zoneId, w] of Object.entries(weights) as [CourtZoneId, (typeof weights)[CourtZoneId]][]) {
    if (!w) continue;
    const z = zones[zoneId];
    z.attack += (w.attack ?? 0) * (player.kills * 1.2 + player.attacks * 0.35);
    z.block += (w.block ?? 0) * player.blocks * 2.2;
    z.dig += (w.dig ?? 0) * player.digs * 1.1;
    z.serve += (w.serve ?? 0) * (player.aces * 2 + Math.max(0, player.aces - player.serveErrors) * 0.5);
    z.reception += (w.reception ?? 0) * Math.max(0, player.receptions - player.receptionErrors * 1.5);
  }
}

export function buildTeamHeatmap(team: TeamInput, power?: TeamPower): TeamHeatmap {
  const zones: Record<CourtZoneId, ReturnType<typeof emptyBreakdown>> = {
    LF: emptyBreakdown(),
    MF: emptyBreakdown(),
    RF: emptyBreakdown(),
    LB: emptyBreakdown(),
    MB: emptyBreakdown(),
    RB: emptyBreakdown(),
  };

  for (const player of team.players) {
    accumulatePlayer(zones, player);
  }

  const scored = (Object.keys(ZONE_META) as CourtZoneId[]).map((id) => {
    const b = zones[id];
    const raw = b.attack + b.block + b.dig + b.serve + b.reception;
    return { id, raw, breakdown: b };
  });

  const max = Math.max(...scored.map((s) => s.raw), 1);
  const mapped: CourtZoneHeat[] = scored.map((s) => ({
    id: s.id,
    label: ZONE_META[s.id].label,
    value: s.raw / max,
    breakdown: {
      attack: s.breakdown.attack,
      block: s.breakdown.block,
      dig: s.breakdown.dig,
      serve: s.breakdown.serve,
      reception: s.breakdown.reception,
    },
  }));

  const sorted = [...mapped].sort((a, b) => b.value - a.value);
  return {
    teamName: team.name,
    isFav: Boolean(team.isFav ?? power?.isFav),
    zones: mapped,
    hotZones: sorted.slice(0, 2).map((z) => z.id),
    coldZones: sorted.slice(-2).map((z) => z.id),
  };
}

export function zoneGridMeta() {
  return ZONE_META;
}

export function kindForPeakIntensity(intensity: number): ClipKind {
  if (intensity >= 0.85) return "kill";
  if (intensity >= 0.7) return "ace";
  if (intensity >= 0.55) return "block";
  if (intensity >= 0.4) return "rally";
  return "custom";
}
