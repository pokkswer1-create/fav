import type { StoredMatch } from "./storage";
import type { ScoutSession } from "./scout";

export interface LibraryBundle {
  version: 1;
  exportedAt: string;
  matches: StoredMatch[];
  scouts: ScoutSession[];
}

export function exportLibraryBundle(bundle: LibraryBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function importLibraryBundle(raw: string): LibraryBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("보관함 JSON을 파싱할 수 없습니다.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("보관함 형식이 올바르지 않습니다.");
  const obj = parsed as Partial<LibraryBundle>;
  if (obj.version !== 1) throw new Error("지원하지 않는 bundle version 입니다.");
  if (!Array.isArray(obj.matches) || !Array.isArray(obj.scouts)) {
    throw new Error("matches/scouts 배열이 필요합니다.");
  }
  return {
    version: 1,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    matches: obj.matches as StoredMatch[],
    scouts: obj.scouts as ScoutSession[],
  };
}

export function mergeLibraryBundles(
  local: LibraryBundle,
  incoming: LibraryBundle,
): LibraryBundle {
  const matches = new Map<string, StoredMatch>();
  for (const m of [...local.matches, ...incoming.matches]) {
    const prev = matches.get(m.id);
    if (!prev || prev.savedAt <= m.savedAt) matches.set(m.id, m);
  }
  const scouts = new Map<string, ScoutSession>();
  for (const s of [...local.scouts, ...incoming.scouts]) {
    const prev = scouts.get(s.id);
    if (!prev || prev.updatedAt <= s.updatedAt) scouts.set(s.id, s);
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    matches: [...matches.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    scouts: [...scouts.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}
