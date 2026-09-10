"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { demoMatch } from "@/lib/demo-match";
import { apiFetch } from "@/lib/api-client";
import { alignClipsToDuration } from "@/lib/clip-align";
import {
  createPlayerMark,
  marksToClips,
  summarizeMarks,
  type PlayerMark,
} from "@/lib/player-marks";
import { DEFAULT_MATCH_VIDEO, listAvailableMatchVideos, MATCH_VIDEOS, MAX_MATCH_DURATION_LABEL, resolvePreferredMatchVideo, type MatchVideoOption } from "@/lib/match-videos";
import { consumeEditorBridge } from "@/lib/storage";
import type { ClipKind, PlayerStats, VideoClipMarker } from "@/lib/types";
import { WingLogo } from "./SiteHeader";
import { HowToPanel } from "./UiGuide";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clips, setClips] = useState<VideoClipMarker[]>(() => cloneDemoClips());
  const [marks, setMarks] = useState<PlayerMark[]>([]);
  const [markMode, setMarkMode] = useState(false);
  const [customNumber, setCustomNumber] = useState("");
  const [customName, setCustomName] = useState("");
  const [mediaDuration, setMediaDuration] = useState(DEFAULT_MATCH_VIDEO.approxDurationSec);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [matchVideoId, setMatchVideoId] = useState(DEFAULT_MATCH_VIDEO.id);
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_MATCH_VIDEO.src);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [catalog, setCatalog] = useState<MatchVideoOption[]>(
    () => MATCH_VIDEOS.filter((v) => v.kind === "preview"),
  );
  const viewingResultRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = await listAvailableMatchVideos();
      const preferred = await resolvePreferredMatchVideo();
      if (cancelled || file) return;
      setCatalog(available);
      setMatchVideoId(preferred.id);
      setPreviewUrl(preferred.src);
      setMediaDuration(preferred.approxDurationSec);
      if (preferred.kind === "full") {
        setStatus(`${preferred.label} 준비됨 · ${MAX_MATCH_DURATION_LABEL}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const selectedPlayer = useMemo(
    () => ROSTER.find((p) => p.number === selectedNumber) ?? ROSTER[0],
    [selectedNumber],
  );

  const activeMarkTarget = useMemo(() => {
    const typed = Number(customNumber);
    if (customNumber.trim() && Number.isFinite(typed) && typed >= 0 && typed <= 99) {
      return {
        number: Math.round(typed),
        name: customName.trim() || `선수`,
        id: `custom-${Math.round(typed)}`,
      };
    }
    return {
      number: selectedPlayer.number,
      name: selectedPlayer.name,
      id: selectedPlayer.id,
    };
  }, [customName, customNumber, selectedPlayer]);

  const markSummary = useMemo(() => summarizeMarks(marks), [marks]);

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

  function addMarkAtTime(opts?: { xNorm?: number; yNorm?: number; timeSec?: number }) {
    const video = videoRef.current;
    const timeSec =
      typeof opts?.timeSec === "number"
        ? opts.timeSec
        : video && Number.isFinite(video.currentTime)
          ? video.currentTime
          : 0;
    const mark = createPlayerMark({
      timeSec,
      playerNumber: activeMarkTarget.number,
      playerName: activeMarkTarget.name,
      playerId: activeMarkTarget.id,
      xNorm: opts?.xNorm,
      yNorm: opts?.yNorm,
    });
    setMarks((prev) => [...prev, mark].sort((a, b) => a.timeSec - b.timeSec));
    setError(null);
    setStatus(
      `#${mark.playerNumber} ${mark.playerName} 마크 @ ${mark.timeSec.toFixed(1)}s (총 ${marks.length + 1}개)`,
    );
  }

  function onVideoClick(e: MouseEvent<HTMLVideoElement>) {
    if (!markMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xNorm = rect.width > 0 ? (e.clientX - rect.left) / rect.width : undefined;
    const yNorm = rect.height > 0 ? (e.clientY - rect.top) / rect.height : undefined;
    addMarkAtTime({ xNorm, yNorm, timeSec: e.currentTarget.currentTime });
  }

  function buildClipsFromMarks(onlySelected = false) {
    if (!marks.length) {
      setError("찍은 선수 마크가 없습니다. 번호 찍기 모드에서 영상을 클릭하거나 ‘지금 시각에 찍기’를 누르세요.");
      return;
    }
    const next = marksToClips(marks, mediaDuration, {
      onlyPlayerNumber: onlySelected ? activeMarkTarget.number : undefined,
      padSec: 1.2,
      mergeGapSec: 2.5,
      kind: "custom",
    });
    if (!next.length) {
      setError("선택한 선수의 마크로 만든 클립이 없습니다.");
      return;
    }
    setClips(next);
    setError(null);
    setStatus(
      onlySelected
        ? `#${activeMarkTarget.number} 마크 ${next.length}클립 생성 — 하이라이트 생성 가능`
        : `찍은 선수 ${markSummary.length}명 → ${next.length}클립 생성 — 하이라이트 생성 가능`,
    );
  }

  function seekToMark(mark: PlayerMark) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = mark.timeSec;
    void video.play().catch(() => undefined);
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
          등번호가 안 보이면 OCR 대신 <strong>번호를 직접 찍어</strong> 선수에 연결한 뒤, 찍힌
          선수 컷으로 하이라이트를 만드세요.
        </p>
      </section>

      <HowToPanel
        title="긴 경기 영상"
        steps={[
          `① 전체 세트(또는 업로드, ${MAX_MATCH_DURATION_LABEL})를 고릅니다.`,
          "② 스카우트 스탬프·번호 찍기로 컷을 만듭니다 (자동 감지/OCR은 짧은 영상용).",
          "③ 하이라이트 생성 시 해당 구간만 서버로 보냅니다.",
        ]}
      />

      <HowToPanel
        title="번호가 안 보일 때"
        steps={[
          "① 선수 선택(또는 번호·이름 직접 입력) → ‘번호 찍기’ 켜기",
          "② 영상에서 그 선수가 보일 때 클릭(또는 ‘지금 시각에 찍기’)",
          "③ ‘찍은 선수 컷 만들기’ → 하이라이트 생성",
        ]}
      />

      <section className="editor-layout">
        <div className="video-pane">
          <div className={`video-frame ${markMode ? "is-marking" : ""}`}>
            <video
              ref={videoRef}
              key={previewUrl}
              src={previewUrl}
              controls
              playsInline
              onClick={onVideoClick}
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
            {markMode ? (
              <p className="mark-mode-hint">
                찍기 ON · 클릭 시 #{activeMarkTarget.number} {activeMarkTarget.name}
              </p>
            ) : null}
          </div>
          <div className="upload-row">
            <label>
              경기 영상
              <select
                value={file ? "" : matchVideoId}
                aria-label="경기 영상 선택"
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const hit = catalog.find((v) => v.id === id) ?? MATCH_VIDEOS.find((v) => v.id === id);
                  if (!hit) return;
                  viewingResultRef.current = false;
                  setFile(null);
                  setMatchVideoId(hit.id);
                  setPreviewUrl(hit.src);
                  setMediaDuration(hit.approxDurationSec);
                  setMarks([]);
                  setError(null);
                  setStatus(`${hit.label} 로드 · 원본 ${hit.sourceFile}`);
                }}
              >
                {file ? <option value="">업로드 파일 사용 중</option> : null}
                {catalog.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="btn ghost file-btn">
              영상 업로드 ({MAX_MATCH_DURATION_LABEL})
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  viewingResultRef.current = false;
                  if (next) {
                    setPreviewUrl(URL.createObjectURL(next));
                    setStatus(`업로드: ${next.name} · ${MAX_MATCH_DURATION_LABEL}까지 지원`);
                  } else {
                    setPreviewUrl(DEFAULT_MATCH_VIDEO.src);
                    setMatchVideoId(DEFAULT_MATCH_VIDEO.id);
                    setMediaDuration(DEFAULT_MATCH_VIDEO.approxDurationSec);
                  }
                }}
              />
            </label>
            <p className="hint">
              {file
                ? file.name
                : `${MATCH_VIDEOS.find((v) => v.id === matchVideoId)?.label ?? "실경기"} · Drive 원본 프록시`}{" "}
              · 미디어 {mediaDuration.toFixed(1)}s · {MAX_MATCH_DURATION_LABEL} · 유효 클립 {validClips.length}개 /{" "}
              {totalSeconds.toFixed(1)}s
            </p>
          </div>
        </div>

        <div className="clip-pane">
          <div className="player-track-bar">
            <label>
              로스터 선수
              <select
                value={selectedNumber}
                onChange={(e) => {
                  setSelectedNumber(Number(e.target.value));
                  setCustomNumber("");
                }}
                aria-label="트래킹할 선수"
              >
                {ROSTER.map((p) => (
                  <option key={p.id} value={p.number}>
                    #{p.number} {p.name} ({p.position})
                  </option>
                ))}
              </select>
            </label>
            <label>
              번호 직접
              <input
                type="number"
                min={0}
                max={99}
                placeholder="예: 14"
                value={customNumber}
                onChange={(e) => setCustomNumber(e.target.value)}
                aria-label="직접 입력 등번호"
              />
            </label>
            <label>
              이름 직접
              <input
                type="text"
                placeholder="선택"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                aria-label="직접 입력 선수 이름"
              />
            </label>
            <button
              type="button"
              className={`btn ghost ${markMode ? "is-active" : ""}`}
              disabled={locked}
              onClick={() => setMarkMode((v) => !v)}
            >
              {markMode ? "번호 찍기 ON" : "번호 찍기"}
            </button>
            <button type="button" className="btn ghost" disabled={locked} onClick={() => addMarkAtTime()}>
              지금 시각에 #{activeMarkTarget.number} 찍기
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={locked || marks.length === 0}
              onClick={() => buildClipsFromMarks(false)}
            >
              찍은 선수 컷 만들기
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={locked || marks.length === 0}
              onClick={() => buildClipsFromMarks(true)}
            >
              #{activeMarkTarget.number}만 컷
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={locked}
              onClick={() => void trackSelectedPlayer()}
              title="OCR 기반 — 등번호가 잘 보일 때만"
            >
              {tracking ? "OCR 중…" : "OCR 선수 추적"}
            </button>
          </div>

          {marks.length > 0 ? (
            <div className="mark-panel">
              <div className="mark-summary">
                {markSummary.map((row) => (
                  <span key={row.playerNumber}>
                    #{row.playerNumber} {row.playerName} · {row.count}
                  </span>
                ))}
                <button type="button" className="btn ghost danger" onClick={() => setMarks([])}>
                  마크 전체 삭제
                </button>
              </div>
              <ul className="mark-list">
                {marks.map((mark) => (
                  <li key={mark.id}>
                    <button type="button" className="mark-jump" onClick={() => seekToMark(mark)}>
                      #{mark.playerNumber} {mark.playerName} @ {mark.timeSec.toFixed(1)}s
                      {typeof mark.xNorm === "number" ? " · 위치핀" : ""}
                    </button>
                    <button
                      type="button"
                      className="btn ghost danger"
                      onClick={() => setMarks((prev) => prev.filter((m) => m.id !== mark.id))}
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="hint mark-empty">
              등번호가 안 보이면 OCR 대신 번호를 직접 찍으세요. 현재 대상: #
              {activeMarkTarget.number} {activeMarkTarget.name}
            </p>
          )}

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
                setMarks([]);
                setMarkMode(false);
                setFile(null);
                setMatchVideoId(DEFAULT_MATCH_VIDEO.id);
                setPreviewUrl(DEFAULT_MATCH_VIDEO.src);
                setError(null);
                setStatus(`데모 클립 + ${DEFAULT_MATCH_VIDEO.label}`);
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
