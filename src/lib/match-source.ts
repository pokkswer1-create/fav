import { existsSync } from "node:fs";
import path from "node:path";
import { findMatchVideo } from "./match-videos";

/**
 * Resolve a catalog match video id to an on-disk path under public/match.
 * Used when the editor plays a bundled proxy without re-uploading the file.
 */
export function resolveBundledMatchPath(matchVideoId: string | null | undefined): string | null {
  const id = String(matchVideoId ?? "").trim();
  if (!id) return null;
  const option = findMatchVideo(id);
  if (!option) return null;
  const rel = option.src.replace(/^\//, "");
  // Only allow files under public/match (including match/ref/…).
  if (!rel.startsWith("match/") || rel.includes("..") || path.isAbsolute(rel)) {
    return null;
  }
  const full = path.join(process.cwd(), "public", rel);
  if (!existsSync(full)) return null;
  return full;
}
