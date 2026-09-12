import { z } from "zod";

const positionSchema = z.enum(["OH", "OPP", "MB", "S", "L", "U"]);

export const playerStatsSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(40),
  number: z.number().int().min(0).max(99),
  position: positionSchema,
  attacks: z.number().min(0).max(500),
  kills: z.number().min(0).max(500),
  attackErrors: z.number().min(0).max(500),
  blocks: z.number().min(0).max(200),
  digs: z.number().min(0).max(500),
  aces: z.number().min(0).max(100),
  serveErrors: z.number().min(0).max(100),
  receptions: z.number().min(0).max(500),
  receptionErrors: z.number().min(0).max(200),
  sets: z.number().min(0).max(1000),
  setErrors: z.number().min(0).max(200),
});

export const teamInputSchema = z.object({
  name: z.string().min(1).max(60),
  shortName: z.string().min(1).max(20),
  isFav: z.boolean().optional(),
  players: z.array(playerStatsSchema).min(1).max(20),
  setScores: z.array(z.number().min(0).max(50)).max(7),
});

export const matchInputSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  date: z.string().min(4).max(32),
  venue: z.string().min(1).max(80),
  home: teamInputSchema,
  away: teamInputSchema,
});

export const clipKindSchema = z.enum([
  "kill",
  "block",
  "ace",
  "dig",
  "rally",
  "error",
  "custom",
]);

export const videoClipSchema = z.object({
  id: z.string().min(1).max(80),
  // Allow out-of-range inputs — alignClipsToDuration clamps to media length.
  startSec: z.number().finite().min(-86_400).max(172_800),
  endSec: z.number().finite().min(-86_400).max(172_800),
  kind: clipKindSchema,
  label: z.string().max(80).optional().default(""),
  playerId: z.string().max(64).optional(),
  playerName: z.string().max(40).optional(),
  playerNumber: z.number().int().min(0).max(99).optional(),
  skill: z.string().max(8).optional(),
  effect: z.string().max(4).optional(),
  combination: z.string().max(24).optional(),
  skillLine: z.string().max(48).optional(),
  homeScore: z.number().int().min(0).max(99).optional(),
  awayScore: z.number().int().min(0).max(99).optional(),
  setIndex: z.number().int().min(0).max(9).optional(),
  serveTeam: z.enum(["home", "away", "none"]).optional(),
});

export const clipsPayloadSchema = z.array(videoClipSchema).min(1).max(20);

export const highlightOverlaySchema = z.object({
  homeName: z.string().min(1).max(40).default("FAV"),
  awayName: z.string().min(1).max(40).default("AWAY"),
  includeTitleCard: z.boolean().optional().default(true),
  titleSubtitle: z.string().max(60).optional().default("Total Analysis"),
  showCourtLines: z.boolean().optional().default(true),
  showLogo: z.boolean().optional().default(true),
});

export const rosterSchema = z.array(playerStatsSchema).max(40);
