"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { demoMatch } from "@/lib/demo-match";
import { apiFetch, sampleVideoUrl } from "@/lib/api-client";
import { alignClipsToDuration } from "@/lib/clip-align";
import { consumeEditorBridge } from "@/lib/storage";
import type { ClipKind, PlayerStats, VideoClipMarker } from "@/lib/types";
import { WingLogo } from "./SiteHeader";

const KIND_OPTIONS: { value: ClipKind; label: string }[] = [
  { value: "kill", label: "킬" },
  { value: "block", label: "블로킹" },
  { value: "ace", label: "에이스" },
  { value: "dig", label: "디그" },
  { value: "rally", label: "랠리" },
  { value: "error", label: "범실" },
  { value: "custom", label: "커스텀" },
];

const ROSTER: PlayerStats[] = [...demoMatch.home.players, ...demoMatch.away.players];

const DEMO_CLIPS: VideoClipMarker[] = [
  { id: "c1", startSec: 1, endSec: 5, kind: "ace", label: "오프닝 에이스" },
  { id: "c2", startSec: 7, endSec: 12, kind: "kill", label: "파이프 킬" },
  { id: "c3", startSec: 14, endSec: 18, kind: "block", label: "미들 블로킹" },
];

function cloneDemoClips(): VideoClipMarker[] {
  return DEMO_CLIPS.map((clip) => ({ ...clip }));
}

function newClip(): VideoClipMarker {
  return {
    id: crypto.randomUUID(),
    startSec: 0,
    endSec: 4,
    kind: "kill",
    label: "새 클립",
  };
}

function parseSec(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const next = Number(raw);
  return Number.isFinite(next) ? Math.max(0, next) : fallback;
}

export function VideoEditorWorkbench() {
  const search = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [clips, setClips] = useState<VideoClipMarker[]>(() => cloneDemoClips());
  const [mediaDuration, setMediaDuration] = useState(20);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(() => sampleVideoUrl());
  const [bridgeReady, setBridgeReady] = useState(false);
  const viewingResultRef = useRef(false);

  const selectedPlayer = useMemo(
    () => ROSTER.find((p) => p.number === selectedNumber) ?? ROSTER[0],
    [selectedNumber],
  );

  const validClips = useMemo(
    () => alignClipsToDuration(clips, mediaDuration),
    [clips, mediaDuration],
  );

  const totalSeconds = useMemo(
    () => validClips.reduce((sum, c) => sum + (c.endSec - c.startSec), 0),
    [validClips],
  );

  useEffect(() => {
    if (search.get("bridge") !== "1") {
      setBridgeReady(true);
      return;
    }
    const payload = consumeEditorBridge();
    setBridgeReady(true);
    if (!payload) {
      setStatus("연결 데이터가 없습니다. 스카우트/분석에서 다시 보내 주세요.");
      return;
    }
    if (payload.playerNumber) setSelectedNumber(payload.playerNumber);
    if (payload.mediaDurationSec && payload.mediaDurationSec > 0) {
      setMediaDuration(payload.mediaDurationSec);
    }
    const duration = payload.mediaDurationSec && payload.mediaDurationSec > 0 ? payload.mediaDurationSec : mediaDuration;
    if (payload.clips?.length) {
      const aligned = alignClipsToDuration(payload.clips, duration);
      setClips(aligned);
      setStatus(payload.message ?? `브리지 클립 ${aligned.length}개 로드`);
    } else if (payload.autoTrack && payload.playerNumber) {
      setStatus(payload.message ?? `#${payload.playerNumber} 자동 트래킹 준비`);
      // fire after state settles
      window.setTimeout(() => {
        void trackSelectedPlayer(payload.playerNumber);
      }, 50);
    } else if (payload.message) {
      setStatus(payload.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updateClip(id: string, patch: Partial<VideoClipMarker>) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function autoDetectScenes() {
    try {
      setDetecting(true);
      setError(null);
      setStatus(null);
      const form = new FormData();
      if (file) form.append("video", file);
      const res = await apiFetch("/api/video/detect", { method: "POST", body: form });
      const data = (await res.json()) as {
        error?: string;
        clips?: VideoClipMarker[];
        method?: string;
        durationSec?: number;
        reliable?: boolean;
        warning?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `감지 실패 (${res.status})`);
      if (!data.clips?.length) throw new Error("감지된 장면이 없습니다.");
      const duration = data.durationSec && data.durationSec > 0 ? data.durationSec : mediaDuration;
      setMediaDuration(duration);
      const aligned = alignClipsToDuration(data.clips, duration);
      const methodLabel =
        data.method === "silence-gaps" ? "오디오 피크" : "그리드 폴백";
      const unreliable = data.reliable === false || data.method === "fallback-grid" || aligned.length <= 1;
      if (unreliable) {
        setClips([]);
        setError(
          data.warning ??
            `자동 장면 감지가 신뢰되지 않습니다 (${methodLabel}, ${aligned.length}클립). 스카우트 타임스탬프 컷을 사용하세요.`,
        );
        setStatus(null);
        return;
      }
      setClips(aligned);
      setStatus(
        `자동 장면 감지 ${aligned.length}클립 · ${methodLabel} · ${duration.toFixed(1)}s`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "장면 감지 실패");
    } finally {
      setDetecting(false);
    }
  }

  async function trackSelectedPlayer(forceNumber?: number) {
    const number = forceNumber ?? selectedPlayer.number;
    const player = ROSTER.find((p) => p.number === number) ?? selectedPlayer;
    try {
      setTracking(true);
      setError(null);
      setStatus(null);
      const form = new FormData();
      if (file) form.append("video", file);
      form.append("number", String(player.number));
      form.append("roster", JSON.stringify(ROSTER));
      const res = await apiFetch("/api/video/track-player", { method: "POST", body: form });
      const data = (await res.json()) as {
        error?: string;
        clips?: VideoClipMarker[];
        method?: string;
        detections?: unknown[];
        playerName?: string;
        playerNumber?: number;
        durationSec?: number;
        quality?: number;
        notes?: string[];
      };
      if (!res.ok) throw new Error(data.error ?? `트래킹 실패 (${res.status})`);
      if (!data.clips?.length) throw new Error("선수 구간을 찾지 못했습니다. 스카우트 타임스탬프 컷을 사용하세요.");
      const duration = data.durationSec && data.durationSec > 0 ? data.durationSec : mediaDuration;
      setMediaDuration(duration);
      const aligned = alignClipsToDuration(data.clips, duration);
      setSelectedNumber(player.number);
      const q = typeof data.quality === "number" ? ` · 품질 ${(data.quality * 100).toFixed(0)}%` : "";
      const note = data.notes?.length ? ` · ${data.notes.join(" / ")}` : "";
      const invented = data.method === "stats-timeline";
      const lowQuality = typeof data.quality === "number" && data.quality < 0.45;
      if (invented || lowQuality) {
        setClips([]);
        setError(
          `#${data.playerNumber} 트래킹 신뢰도가 낮습니다 (${data.method}${q}). 스카우트 타임스탬프 컷을 사용하세요.${note}`,
        );
        setStatus(null);
        return;
      }
      setClips(aligned);
      const caution = data.method === "ocr+stats" ? " · 주의: OCR+스탯 혼합" : "";
      setStatus(
        `#${data.playerNumber} ${data.playerName} 트래킹 ${aligned.length}클립 · ${data.method} · 감지 ${data.detections?.length ?? 0}프레임${q}${note}${caution} · 길이정렬 OK`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "선수 트래킹 실패");
    } finally {
      setTracking(false);
    }
  }

  async function renderHighlights() {
    try {
      setBusy(true);
      setError(null);
      setStatus(null);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);

      if (validClips.length === 0) {
        throw new Error("유효한 클립이 없습니다. 종료 시간이 시작보다 커야 합니다.");
      }

      const form = new FormData();
      if (file) form.append("video", file);
      form.append("clips", JSON.stringify(validClips));

      const res = await apiFetch("/api/video/highlights", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `편집 실패 (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      viewingResultRef.current = true;
      setDownloadUrl(url);
      setPreviewUrl(url);
      const playerTag = validClips.find((c) => c.playerNumber)?.playerNumber;
      setStatus(
        `하이라이트 ${validClips.length}클립 생성 완료 · ${(blob.size / 1024).toFixed(0)}KB${
          playerTag ? ` · #${playerTag}` : ""
        } · 원본 타임라인 ${mediaDuration.toFixed(1)}s 유지`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "편집 실패");
    } finally {
      setBusy(false);
    }
  }

  const locked = busy || detecting || tracking;

  if (!bridgeReady) {
    return (
      <div className="workbench">
        <p className="status-line">편집기 준비 중…</p>
      </div>
    );
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">HIGHLIGHT DESK</p>
        <h1>경기 영상 하이라이트 편집</h1>
        <p className="lede">
          스카우트 타임스탬프·선수 트래킹·장면 감지 클립을 영상 길이에 맞춰 정렬한 뒤 하이라이트
          MP4를 만듭니다.
        </p>
      </section>

      <section className="editor-layout">
        <div className="video-pane">
          <div className="video-frame">
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              playsInline
              onLoadedMetadata={(e) => {
                // Never re-align source clips to the rendered highlight length —
                // that would shrink/destroy usable timestamps after a successful render.
                if (viewingResultRef.current) return;
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) {
                  setMediaDuration(d);
                  setClips((prev) => alignClipsToDuration(prev, d));
                }
              }}
            />
            <div className="video-badge">
              <WingLogo size={28} />
              <span>FAV CUT</span>
            </div>
          </div>
          <div className="upload-row">
            <label className="btn ghost file-btn">
              영상 업로드
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  viewingResultRef.current = false;
                  if (next) setPreviewUrl(URL.createObjectURL(next));
                  else {
                    setPreviewUrl(sampleVideoUrl());
                    setMediaDuration(20);
                  }
                }}
              />
            </label>
            <p className="hint">
              {file ? file.name : "업로드 없으면 20초 데모 영상(등번호 7/10/4 오버레이)을 사용합니다."}{" "}
              · 미디어 {mediaDuration.toFixed(1)}s · 유효 클립 {validClips.length}개 /{" "}
              {totalSeconds.toFixed(1)}s
            </p>
          </div>
        </div>

        <div className="clip-pane">
          <div className="player-track-bar">
            <label>
              트래킹 선수
              <select
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(Number(e.target.value))}
                aria-label="트래킹할 선수"
              >
                {ROSTER.map((p) => (
                  <option key={p.id} value={p.number}>
                    #{p.number} {p.name} ({p.position})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={locked}
              onClick={() => void trackSelectedPlayer()}
            >
              {tracking ? "트래킹 중…" : `#${selectedPlayer.number} 선수 컷 만들기`}
            </button>
          </div>

          <div className="pane-actions">
            <button type="button" className="btn ghost" onClick={() => setClips((c) => [...c, newClip()])}>
              클립 추가
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                viewingResultRef.current = false;
                setClips(cloneDemoClips());
                setPreviewUrl(sampleVideoUrl());
                setMediaDuration(20);
                setError(null);
                setStatus(null);
              }}
            >
              데모 타임라인
            </button>
            <button type="button" className="btn ghost" disabled={locked} onClick={autoDetectScenes}>
              {detecting ? "감지 중…" : "자동 장면 감지"}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={locked || validClips.length === 0}
              onClick={renderHighlights}
            >
              {busy ? "렌더 중…" : "하이라이트 생성"}
            </button>
          </div>

          <ul className="clip-list">
            {clips.map((clip, index) => {
              const invalid = clip.endSec <= clip.startSec;
              return (
                <li key={clip.id} className={invalid ? "is-invalid" : undefined}>
                  <span className="clip-index">{index + 1}</span>
                  <input
                    value={clip.label}
                    onChange={(e) => updateClip(clip.id, { label: e.target.value })}
                    aria-label="클립 라벨"
                  />
                  <select
                    value={clip.kind}
                    onChange={(e) => updateClip(clip.id, { kind: e.target.value as ClipKind })}
                    aria-label="클립 종류"
                  >
                    {KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {clip.playerNumber ? (
                    <p className="player-tag">
                      #{clip.playerNumber} {clip.playerName}
                    </p>
                  ) : null}
                  <label>
                    시작
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={clip.startSec}
                      onChange={(e) =>
                        updateClip(clip.id, { startSec: parseSec(e.target.value, clip.startSec) })
                      }
                    />
                  </label>
                  <label>
                    종료
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={clip.endSec}
                      onChange={(e) =>
                        updateClip(clip.id, { endSec: parseSec(e.target.value, clip.endSec) })
                      }
                    />
                  </label>
                  {invalid ? <p className="error-line">종료 시간이 시작보다 커야 합니다.</p> : null}
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => setClips((prev) => prev.filter((c) => c.id !== clip.id))}
                  >
                    삭제
                  </button>
                </li>
              );
            })}
          </ul>

          {error ? <p className="error-line">{error}</p> : null}
          {status ? <p className="status-line">{status}</p> : null}
          {downloadUrl ? (
            <a
              className="btn primary download"
              href={downloadUrl}
              download={
                selectedPlayer
                  ? `fav-player-${selectedPlayer.number}-highlights.mp4`
                  : "fav-highlights.mp4"
              }
            >
              하이라이트 다운로드
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
