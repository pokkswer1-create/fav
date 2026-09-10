/** Bundled real-match proxies served from /public/match (local Drive import). */
export interface MatchVideoOption {
  id: string;
  label: string;
  src: string;
  durationLabel: string;
  sourceFile: string;
  /** Approximate duration in seconds (for UI before metadata loads). */
  approxDurationSec: number;
}

export const MATCH_VIDEOS: MatchVideoOption[] = [
  {
    id: "set1-full",
    label: "세트1 · 전체 경기 (~1시간 22분)",
    src: "/match/set1-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2410.MOV",
    approxDurationSec: 4903,
  },
  {
    id: "set2-full",
    label: "세트2 · 전체 경기 (~1시간)",
    src: "/match/set2-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2431.MOV",
    approxDurationSec: 3621,
  },
  {
    id: "set3-full",
    label: "세트3 · 전체 경기 (~1시간 2분)",
    src: "/match/set3-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2432.MOV",
    approxDurationSec: 3697,
  },
  {
    id: "set4-full",
    label: "세트4 · 전체 경기 (~56분)",
    src: "/match/set4-full.mp4",
    durationLabel: "전체",
    sourceFile: "IMG_2433.MOV",
    approxDurationSec: 3357,
  },
  {
    id: "set1-8min",
    label: "세트1 · 짧은 미리보기 (8분)",
    src: "/match/set1-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2410.MOV",
    approxDurationSec: 480,
  },
  {
    id: "set2-8min",
    label: "세트2 · 짧은 미리보기 (8분)",
    src: "/match/set2-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2431.MOV",
    approxDurationSec: 480,
  },
  {
    id: "set3-8min",
    label: "세트3 · 짧은 미리보기 (8분)",
    src: "/match/set3-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2432.MOV",
    approxDurationSec: 480,
  },
  {
    id: "set4-8min",
    label: "세트4 · 짧은 미리보기 (8분)",
    src: "/match/set4-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2433.MOV",
    approxDurationSec: 480,
  },
  {
    id: "set1-3min",
    label: "세트1 · 빠른 미리보기 (3분)",
    src: "/match/set1-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2410.MOV",
    approxDurationSec: 180,
  },
  {
    id: "set2-3min",
    label: "세트2 · 빠른 미리보기 (3분)",
    src: "/match/set2-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2431.MOV",
    approxDurationSec: 180,
  },
  {
    id: "set3-3min",
    label: "세트3 · 빠른 미리보기 (3분)",
    src: "/match/set3-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2432.MOV",
    approxDurationSec: 180,
  },
  {
    id: "set4-3min",
    label: "세트4 · 빠른 미리보기 (3분)",
    src: "/match/set4-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2433.MOV",
    approxDurationSec: 180,
  },
];

export const DEFAULT_MATCH_VIDEO = MATCH_VIDEOS[0];

export const MAX_MATCH_DURATION_LABEL = "최대 4시간";

export function findMatchVideo(id: string | null | undefined): MatchVideoOption | null {
  if (!id) return null;
  return MATCH_VIDEOS.find((v) => v.id === id) ?? null;
}
