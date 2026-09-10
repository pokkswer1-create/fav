/** Bundled real-match proxies served from /public/match (local Drive import). */
export interface MatchVideoOption {
  id: string;
  label: string;
  src: string;
  durationLabel: string;
  sourceFile: string;
}

export const MATCH_VIDEOS: MatchVideoOption[] = [
  {
    id: "set1-8min",
    label: "세트1 · 실경기 (8분)",
    src: "/match/set1-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2410.MOV",
  },
  {
    id: "set2-8min",
    label: "세트2 · 실경기 (8분)",
    src: "/match/set2-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2431.MOV",
  },
  {
    id: "set3-8min",
    label: "세트3 · 실경기 (8분)",
    src: "/match/set3-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2432.MOV",
  },
  {
    id: "set4-8min",
    label: "세트4 · 실경기 (8분)",
    src: "/match/set4-8min.mp4",
    durationLabel: "8분",
    sourceFile: "IMG_2433.MOV",
  },
  {
    id: "set1-3min",
    label: "세트1 · 짧은 프록시 (3분)",
    src: "/match/set1-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2410.MOV",
  },
  {
    id: "set2-3min",
    label: "세트2 · 짧은 프록시 (3분)",
    src: "/match/set2-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2431.MOV",
  },
  {
    id: "set3-3min",
    label: "세트3 · 짧은 프록시 (3분)",
    src: "/match/set3-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2432.MOV",
  },
  {
    id: "set4-3min",
    label: "세트4 · 짧은 프록시 (3분)",
    src: "/match/set4-3min.mp4",
    durationLabel: "3분",
    sourceFile: "IMG_2433.MOV",
  },
];

export const DEFAULT_MATCH_VIDEO = MATCH_VIDEOS[0];

export function findMatchVideo(id: string | null | undefined): MatchVideoOption | null {
  if (!id) return null;
  return MATCH_VIDEOS.find((v) => v.id === id) ?? null;
}
