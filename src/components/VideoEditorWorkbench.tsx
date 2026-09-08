"use client";

import { useMemo, useState } from "react";
import type { ClipKind, VideoClipMarker } from "@/lib/types";
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

const DEMO_CLIPS: VideoClipMarker[] = [
  { id: "c1", startSec: 1, endSec: 5, kind: "ace", label: "오프닝 에이스" },
  { id: "c2", startSec: 7, endSec: 12, kind: "kill", label: "파이프 킬" },
  { id: "c3", startSec: 14, endSec: 18, kind: "block", label: "미들 블로킹" },
];

function newClip(): VideoClipMarker {
  return {
    id: crypto.randomUUID(),
    startSec: 0,
    endSec: 4,
    kind: "kill",
    label: "새 클립",
  };
}

export function VideoEditorWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [clips, setClips] = useState<VideoClipMarker[]>(DEMO_CLIPS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("/api/video/highlights");

  const totalSeconds = useMemo(
    () => clips.reduce((sum, c) => sum + Math.max(0, c.endSec - c.startSec), 0),
    [clips],
  );

  function updateClip(id: string, patch: Partial<VideoClipMarker>) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function renderHighlights() {
    try {
      setBusy(true);
      setError(null);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);

      const form = new FormData();
      if (file) form.append("video", file);
      form.append("clips", JSON.stringify(clips));

      const res = await fetch("/api/video/highlights", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `편집 실패 (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setPreviewUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "편집 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workbench">
      <section className="workbench-intro">
        <p className="eyebrow">HIGHLIGHT DESK</p>
        <h1>경기 영상 하이라이트 편집</h1>
        <p className="lede">
          킬·블로킹·에이스 구간을 찍어 붙이면 FAV 훈련/브리핑용 하이라이트 MP4를 만들어 줍니다.
        </p>
      </section>

      <section className="editor-layout">
        <div className="video-pane">
          <div className="video-frame">
            <video key={previewUrl} src={previewUrl} controls playsInline />
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
                  if (next) setPreviewUrl(URL.createObjectURL(next));
                  else setPreviewUrl("/api/video/highlights");
                }}
              />
            </label>
            <p className="hint">
              {file ? file.name : "업로드 없으면 20초 데모 영상을 사용합니다."} · 예상 길이{" "}
              {totalSeconds.toFixed(1)}s
            </p>
          </div>
        </div>

        <div className="clip-pane">
          <div className="pane-actions">
            <button type="button" className="btn ghost" onClick={() => setClips((c) => [...c, newClip()])}>
              클립 추가
            </button>
            <button type="button" className="btn ghost" onClick={() => setClips(DEMO_CLIPS)}>
              데모 타임라인
            </button>
            <button type="button" className="btn primary" disabled={busy} onClick={renderHighlights}>
              {busy ? "렌더 중…" : "하이라이트 생성"}
            </button>
          </div>

          <ul className="clip-list">
            {clips.map((clip, index) => (
              <li key={clip.id}>
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
                <label>
                  시작
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={clip.startSec}
                    onChange={(e) => updateClip(clip.id, { startSec: Number(e.target.value) })}
                  />
                </label>
                <label>
                  종료
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={clip.endSec}
                    onChange={(e) => updateClip(clip.id, { endSec: Number(e.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={() => setClips((prev) => prev.filter((c) => c.id !== clip.id))}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>

          {error ? <p className="error-line">{error}</p> : null}
          {downloadUrl ? (
            <a className="btn primary download" href={downloadUrl} download="fav-highlights.mp4">
              하이라이트 다운로드
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
