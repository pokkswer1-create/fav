import type { MatchAnalysis, MatchInput, VideoClipMarker } from "./types";
import type { ScoutSession } from "./scout";

const MATCH_KEY = "fav.scout.matches.v1";
const SCOUT_KEY = "fav.scout.sessions.v1";
const BRIDGE_KEY = "fav.scout.bridge.v1";

export interface StoredMatch {
  id: string;
  savedAt: string;
  match: MatchInput;
  analysis?: MatchAnalysis;
  notes?: string;
}

export interface EditorBridgePayload {
  version: 1;
  createdAt: string;
  source: "analyze" | "scout" | "library";
  playerNumber?: number;
  playerName?: string;
  clips?: VideoClipMarker[];
  autoTrack?: boolean;
  matchId?: string;
  message?: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function listStoredMatches(): StoredMatch[] {
  return readJson<StoredMatch[]>(MATCH_KEY, []).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function saveStoredMatch(entry: StoredMatch): void {
  const all = listStoredMatches().filter((m) => m.id !== entry.id);
  all.unshift(entry);
  writeJson(MATCH_KEY, all.slice(0, 50));
}

export function getStoredMatch(id: string): StoredMatch | null {
  return listStoredMatches().find((m) => m.id === id) ?? null;
}

export function deleteStoredMatch(id: string): void {
  writeJson(
    MATCH_KEY,
    listStoredMatches().filter((m) => m.id !== id),
  );
}

export function listScoutSessions(): ScoutSession[] {
  return readJson<ScoutSession[]>(SCOUT_KEY, []).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function saveScoutSession(session: ScoutSession): void {
  const all = listScoutSessions().filter((s) => s.id !== session.id);
  all.unshift(session);
  writeJson(SCOUT_KEY, all.slice(0, 50));
}

export function getScoutSession(id: string): ScoutSession | null {
  return (
    listScoutSessions().find((s) => s.id === id || s.matchId === id) ?? null
  );
}

export function setEditorBridge(payload: EditorBridgePayload): void {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(payload));
}

export function consumeEditorBridge(): EditorBridgePayload | null {
  if (!canUseStorage()) return null;
  const raw = window.sessionStorage.getItem(BRIDGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(BRIDGE_KEY);
  try {
    return JSON.parse(raw) as EditorBridgePayload;
  } catch {
    return null;
  }
}

export function peekEditorBridge(): EditorBridgePayload | null {
  if (!canUseStorage()) return null;
  const raw = window.sessionStorage.getItem(BRIDGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EditorBridgePayload;
  } catch {
    return null;
  }
}
