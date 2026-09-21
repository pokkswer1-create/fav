import { createPlayerMark, type PlayerMark } from "./player-marks";

/** Court rotation slots P1–P6 (team perspective, net at top). */
export type CourtSlot = 1 | 2 | 3 | 4 | 5 | 6;

export interface LineupAssignment {
  slot: CourtSlot;
  playerNumber: number;
  playerName: string;
  playerId?: string;
  /** Override default slot coords after optional video refine. */
  xNorm?: number;
  yNorm?: number;
}

export interface CourtSlotMeta {
  slot: CourtSlot;
  label: string;
  shortLabel: string;
  /** Default pin on video frame (0..1). */
  xNorm: number;
  yNorm: number;
  row: 0 | 1;
  col: 0 | 1 | 2;
}

/** Visual court grid: front row 4-3-2, back row 5-6-1. */
export const COURT_SLOTS: CourtSlotMeta[] = [
  { slot: 4, label: "좌전(4)", shortLabel: "P4", xNorm: 0.28, yNorm: 0.4, row: 0, col: 0 },
  { slot: 3, label: "중전(3)", shortLabel: "P3", xNorm: 0.5, yNorm: 0.38, row: 0, col: 1 },
  { slot: 2, label: "우전(2)", shortLabel: "P2", xNorm: 0.72, yNorm: 0.4, row: 0, col: 2 },
  { slot: 5, label: "좌후(5)", shortLabel: "P5", xNorm: 0.28, yNorm: 0.62, row: 1, col: 0 },
  { slot: 6, label: "중후(6)", shortLabel: "P6", xNorm: 0.5, yNorm: 0.64, row: 1, col: 1 },
  { slot: 1, label: "우후(1)", shortLabel: "P1", xNorm: 0.72, yNorm: 0.62, row: 1, col: 2 },
];

export function slotMeta(slot: CourtSlot): CourtSlotMeta {
  return COURT_SLOTS.find((s) => s.slot === slot) ?? COURT_SLOTS[0];
}

export function emptyLineup(): Array<LineupAssignment | null> {
  return [null, null, null, null, null, null];
}

/** Index 0→P1 … 5→P6 for array storage. */
export function lineupIndex(slot: CourtSlot): number {
  return slot - 1;
}

export function getLineupSlot(
  lineup: Array<LineupAssignment | null>,
  slot: CourtSlot,
): LineupAssignment | null {
  return lineup[lineupIndex(slot)] ?? null;
}

export function setLineupSlot(
  lineup: Array<LineupAssignment | null>,
  assignment: LineupAssignment | null,
  slot: CourtSlot,
): Array<LineupAssignment | null> {
  const next = [...lineup];
  // Clear same player from other slots
  if (assignment) {
    for (let i = 0; i < next.length; i += 1) {
      if (next[i]?.playerNumber === assignment.playerNumber) next[i] = null;
    }
  }
  next[lineupIndex(slot)] = assignment
    ? {
        ...assignment,
        slot,
        xNorm:
          typeof assignment.xNorm === "number"
            ? Math.max(0, Math.min(1, assignment.xNorm))
            : undefined,
        yNorm:
          typeof assignment.yNorm === "number"
            ? Math.max(0, Math.min(1, assignment.yNorm))
            : undefined,
      }
    : null;
  return next;
}

export function filledAssignments(lineup: Array<LineupAssignment | null>): LineupAssignment[] {
  return lineup.filter((a): a is LineupAssignment => a != null);
}

function seedCoords(a: LineupAssignment): { xNorm: number; yNorm: number } {
  const meta = slotMeta(a.slot);
  return {
    xNorm: typeof a.xNorm === "number" ? a.xNorm : meta.xNorm,
    yNorm: typeof a.yNorm === "number" ? a.yNorm : meta.yNorm,
  };
}

/**
 * Build lineup seed marks (one per filled slot).
 * Click-refinement marks (without courtSlot) are kept separately by merge.
 */
export function lineupToSeedMarks(
  lineup: Array<LineupAssignment | null>,
  timeSec = 0,
): PlayerMark[] {
  return filledAssignments(lineup).map((a) => {
    const { xNorm, yNorm } = seedCoords(a);
    return createPlayerMark({
      timeSec,
      playerNumber: a.playerNumber,
      playerName: a.playerName,
      playerId: a.playerId,
      xNorm,
      yNorm,
      note: `lineup:P${a.slot}`,
    });
  });
}

/** True if mark was created from lineup seed. */
export function isLineupSeedMark(mark: PlayerMark): boolean {
  return Boolean(mark.note?.startsWith("lineup:P"));
}

/**
 * Apply current lineup seeds into marks:
 * replace previous lineup seeds, keep click-refinement marks.
 */
export function mergeLineupIntoMarks(
  existing: PlayerMark[],
  lineup: Array<LineupAssignment | null>,
  timeSec = 0,
): PlayerMark[] {
  const refinements = existing.filter((m) => !isLineupSeedMark(m));
  const seeds = lineupToSeedMarks(lineup, timeSec);
  return [...seeds, ...refinements].sort((a, b) => a.timeSec - b.timeSec || a.playerNumber - b.playerNumber);
}

/** Rotate slots +1 (P1→P6, P2→P1, … classic side-out advance). */
export function rotateLineup(
  lineup: Array<LineupAssignment | null>,
): Array<LineupAssignment | null> {
  // Map: newSlot gets who was in oldSlot where oldSlot = newSlot % 6 + 1? 
  // Classic: players move P1→P6→P5→P4→P3→P2→P1
  // So content that was in slot S moves to nextSlot(S).
  const moveTo: Record<CourtSlot, CourtSlot> = {
    1: 6,
    6: 5,
    5: 4,
    4: 3,
    3: 2,
    2: 1,
  };
  const next = emptyLineup();
  for (const slot of [1, 2, 3, 4, 5, 6] as CourtSlot[]) {
    const a = getLineupSlot(lineup, slot);
    if (!a) continue;
    const dest = moveTo[slot];
    next[lineupIndex(dest)] = { ...a, slot: dest };
  }
  return next;
}

export function updateLineupCoords(
  lineup: Array<LineupAssignment | null>,
  playerNumber: number,
  xNorm: number,
  yNorm: number,
): Array<LineupAssignment | null> {
  return lineup.map((a) =>
    a && a.playerNumber === playerNumber
      ? {
          ...a,
          xNorm: Math.max(0, Math.min(1, xNorm)),
          yNorm: Math.max(0, Math.min(1, yNorm)),
        }
      : a,
  );
}
