/** Bundled real-match proxies served from /public/match (local Drive import). */
export interface MatchVideoOption {
  id: string;
  label: string;
  src: string;
  durationLabel: string;
  sourceFile: string;
  /** Approximate duration in seconds (for UI before metadata loads). */
  approxDurationSec: number;
  /** Prefer these when present; short previews always available. */
  kind: "full" | "preview";
}

/** Full-length set proxies (promoted into /public/match when encode finishes). */
const FULL_MATCH_VIDEOS: MatchVideoOption[] = [
  {
    id: "set1-full",
    label: "세트1 · 전체 경기 (~1시간 22분)",
    src: "/match/set1-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2410.MOV",
    approxDurationSec: 4903,
    kind: "full",
  },
  {
    id: "set2-full",
    label: "세트2 · 전체 경기 (~1시간)",
    src: "/match/set2-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2431.MOV",
    approxDurationSec: 3621,
    kind: "full",
  },
  {
    id: "set3-full",
    label: "세트3 · 전체 경기 (~1시간 2분)",
    src: "/match/set3-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2432.MOV",
    approxDurationSec: 3697,
    kind: "full",
  },
  {
    id: "set4-full",
    label: "세트4 · 전체 경기 (~56분)",
    src: "/match/set4-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2433.MOV",
    approxDurationSec: 3357,
    kind: "full",
  },
];

const PREVIEW_MATCH_VIDEOS: MatchVideoOption[] = [
  {
    id: "set1-8min",
    label: "세트1 · 짧은 미리보기 (8분)",
    src: "/match/set1-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2410.MOV",
    approxDurationSec: 480,
    kind: "preview",
  },
  {
    id: "set2-8min",
    label: "세트2 · 짧은 미리보기 (8분)",
    src: "/match/set2-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2431.MOV",
    approxDurationSec: 480,
    kind: "preview",
  },
  {
    id: "set3-8min",
    label: "세트3 · 짧은 미리보기 (8분)",
    src: "/match/set3-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2432.MOV",
    approxDurationSec: 480,
    kind: "preview",
  },
  {
    id: "set4-8min",
    label: "세트4 · 짧은 미리보기 (8분)",
    src: "/match/set4-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2433.MOV",
    approxDurationSec: 480,
    kind: "preview",
  },
  {
    id: "set1-3min",
    label: "세트1 · 빠른 미리보기 (3분)",
    src: "/match/set1-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2410.MOV",
    approxDurationSec: 180,
    kind: "preview",
  },
  {
    id: "set2-3min",
    label: "세트2 · 빠른 미리보기 (3분)",
    src: "/match/set2-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2431.MOV",
    approxDurationSec: 180,
    kind: "preview",
  },
  {
    id: "set3-3min",
    label: "세트3 · 빠른 미리보기 (3분)",
    src: "/match/set3-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2432.MOV",
    approxDurationSec: 180,
    kind: "preview",
  },
  {
    id: "set4-3min",
    label: "세트4 · 빠른 미리보기 (3분)",
    src: "/match/set4-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2433.MOV",
    approxDurationSec: 180,
    kind: "preview",
  },
];

/** Catalog order: full sets first, then previews. Missing full files fall back in UI. */
export const MATCH_VIDEOS: MatchVideoOption[] = [...FULL_MATCH_VIDEOS, ...PREVIEW_MATCH_VIDEOS];

/** Safe default while full-length proxies may still be encoding. */
export const DEFAULT_MATCH_VIDEO =
  PREVIEW_MATCH_VIDEOS.find((v) => v.id === "set1-8min") ?? PREVIEW_MATCH_VIDEOS[0];

export const MAX_MATCH_DURATION_LABEL = "최대 4시간";

export function findMatchVideo(id: string | null | undefined): MatchVideoOption | null {
  if (!id) return null;
  return MATCH_VIDEOS.find((v) => v.id === id) ?? null;
}

/** Prefer an available full set; otherwise keep the current/default preview. */
export async function resolvePreferredMatchVideo(
  preferredId?: string | null,
): Promise<MatchVideoOption> {
  const available = await listAvailableMatchVideos();
  const preferred = available.find((v) => v.id === preferredId);
  return (
    preferred ??
    available.find((v) => v.kind === "full") ??
    available.find((v) => v.id === DEFAULT_MATCH_VIDEO.id) ??
    available[0] ??
    DEFAULT_MATCH_VIDEO
  );
}

export async function listAvailableMatchVideos(): Promise<MatchVideoOption[]> {
  const checks = await Promise.all(
    MATCH_VIDEOS.map(async (candidate) => {
      try {
        const res = await fetch(candidate.src, { method: "HEAD", cache: "no-store" });
        return res.ok ? candidate : null;
      } catch {
        return null;
      }
    }),
  );
  const available = checks.filter(Boolean) as MatchVideoOption[];
  return available.length ? available : [DEFAULT_MATCH_VIDEO];
}
