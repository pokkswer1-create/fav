export type Position = "OH" | "OPP" | "MB" | "S" | "L" | "U";

export type ClipKind =
  | "kill"
  | "block"
  | "ace"
  | "dig"
  | "rally"
  | "error"
  | "custom";

export interface PlayerStats {
  id: string;
  name: string;
  number: number;
  position: Position;
  attacks: number;
  kills: number;
  attackErrors: number;
  blocks: number;
  digs: number;
  aces: number;
  serveErrors: number;
  receptions: number;
  receptionErrors: number;
  sets: number;
  setErrors: number;
}

export interface TeamInput {
  name: string;
  shortName: string;
  isFav?: boolean;
  players: PlayerStats[];
  setScores: number[];
}

export interface MatchInput {
  id: string;
  title: string;
  date: string;
  venue: string;
  home: TeamInput;
  away: TeamInput;
}

export interface PlayerRating {
  playerId: string;
  name: string;
  number: number;
  position: Position;
  attackEfficiency: number;
  killRate: number;
  blockScore: number;
  digScore: number;
  servePressure: number;
  receptionQuality: number;
  overall: number;
  tags: string[];
}

export interface TeamPower {
  teamName: string;
  shortName: string;
  isFav: boolean;
  attackEfficiency: number;
  killRate: number;
  blockPoints: number;
  digTotal: number;
  aceTotal: number;
  serveErrorTotal: number;
  receptionErrorRate: number;
  setErrorRate: number;
  overall: number;
  strengths: string[];
  weaknesses: string[];
  keyPlayers: PlayerRating[];
  playerRatings: PlayerRating[];
}

export interface MatchAnalysis {
  matchId: string;
  title: string;
  winner: "home" | "away" | "draw";
  setScore: string;
  home: TeamPower;
  away: TeamPower;
  matchupNotes: string[];
  coachingPlan: string[];
  highlightSuggestions: HighlightSuggestion[];
}

export interface HighlightSuggestion {
  kind: ClipKind;
  label: string;
  reason: string;
  preferredSeconds: number;
}

export interface VideoClipMarker {
  id: string;
  startSec: number;
  endSec: number;
  kind: ClipKind;
  label: string;
  playerId?: string;
  playerName?: string;
  playerNumber?: number;
  /** DataVolley overlay fields (optional — burned into highlight export) */
  skill?: string;
  effect?: string;
  combination?: string;
  skillLine?: string;
  homeScore?: number;
  awayScore?: number;
  /** 0-based set index */
  setIndex?: number;
  serveTeam?: "home" | "away" | "none";
}
