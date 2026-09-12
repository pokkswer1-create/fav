import type { MatchAnalysis, MatchInput, VideoClipMarker } from "./types";
import type { ScoutSession } from "./scout";
import {
  exportLibraryBundle,
  importLibraryBundle,
  mergeLibraryBundles,
  type LibraryBundle,
} from "./library-bundle";

const MATCH_KEY = "fav.scout.matches.v1";
const SCOUT_KEY = "fav.scout.sessions.v1";
const BRIDGE_KEY = "fav.scout.bridge.v1";
const ROSTER_KEY = "fav.scout.rosters.v1";
const IDB_NAME = "fav-scout-db";
const IDB_STORE = "library";

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
  mediaDurationSec?: number;
  /** DataVolley highlight overlay team names */
  homeName?: string;
  awayName?: string;
}

export interface CustomRosterPlayer {
  id: string;
  name: string;
  number: number;
  position: string;
}

export interface CustomRosters {
  homeName: string;
  awayName: string;
  home: CustomRosterPlayer[];
  away: CustomRosterPlayer[];
  updatedAt: string;
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
  writeJson(MATCH_KEY, all.slice(0, 80));
  void persistLibraryToIdb();
}

export function getStoredMatch(id: string): StoredMatch | null {
  return listStoredMatches().find((m) => m.id === id) ?? null;
}

export function deleteStoredMatch(id: string): void {
  writeJson(
    MATCH_KEY,
    listStoredMatches().filter((m) => m.id !== id),
  );
  void persistLibraryToIdb();
}

export function listScoutSessions(): ScoutSession[] {
  return readJson<ScoutSession[]>(SCOUT_KEY, []).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function saveScoutSession(session: ScoutSession): void {
  const all = listScoutSessions().filter((s) => s.id !== session.id);
  all.unshift(session);
  writeJson(SCOUT_KEY, all.slice(0, 80));
  void persistLibraryToIdb();
}

export function getScoutSession(id: string): ScoutSession | null {
  return listScoutSessions().find((s) => s.id === id || s.matchId === id) ?? null;
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

export function getCustomRosters(): CustomRosters | null {
  return readJson<CustomRosters | null>(ROSTER_KEY, null);
}

export function saveCustomRosters(rosters: CustomRosters): void {
  writeJson(ROSTER_KEY, { ...rosters, updatedAt: new Date().toISOString() });
}

export function buildCurrentLibraryBundle(): LibraryBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    matches: listStoredMatches(),
    scouts: listScoutSessions(),
  };
}

export function applyLibraryBundle(bundle: LibraryBundle, mode: "replace" | "merge" = "merge"): void {
  const next =
    mode === "replace"
      ? bundle
      : mergeLibraryBundles(buildCurrentLibraryBundle(), bundle);
  writeJson(MATCH_KEY, next.matches.slice(0, 80));
  writeJson(SCOUT_KEY, next.scouts.slice(0, 80));
  void persistLibraryToIdb();
}

export function downloadLibraryExport(): void {
  const json = exportLibraryBundle(buildCurrentLibraryBundle());
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fav-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importLibraryFromText(raw: string, mode: "replace" | "merge" = "merge"): LibraryBundle {
  const bundle = importLibraryBundle(raw);
  applyLibraryBundle(bundle, mode);
  return bundle;
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function persistLibraryToIdb(): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(buildCurrentLibraryBundle(), "bundle");
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export async function restoreLibraryFromIdb(): Promise<boolean> {
  const db = await openIdb();
  if (!db) return false;
  const bundle = await new Promise<LibraryBundle | null>((resolve) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get("bundle");
    req.onsuccess = () => resolve((req.result as LibraryBundle) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  if (!bundle?.matches) return false;
  // Prefer IDB only when localStorage is empty
  if (listStoredMatches().length === 0 && listScoutSessions().length === 0) {
    applyLibraryBundle(bundle, "replace");
    return true;
  }
  return false;
}
