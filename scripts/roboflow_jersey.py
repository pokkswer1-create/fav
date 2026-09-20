#!/usr/bin/env python3
"""Sample video frames and call Roboflow detect API for jersey digits."""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def probe_duration(path: str) -> float:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            path,
        ],
        text=True,
    ).strip()
    try:
        return float(raw)
    except ValueError:
        return 0.0


def extract_frame(video: str, t: float, out: Path) -> bool:
    try:
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{t:.3f}",
                "-i",
                video,
                "-frames:v",
                "1",
                "-q:v",
                "3",
                str(out),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return out.exists() and out.stat().st_size > 0
    except Exception:
        return False


def call_roboflow(image: Path, api_key: str, model: str) -> dict:
    b64 = base64.b64encode(image.read_bytes()).decode("ascii")
    url = f"https://detect.roboflow.com/{model}?api_key={urllib.parse.quote(api_key)}"
    req = urllib.request.Request(
        url,
        data=b64.encode("ascii"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("video")
    p.add_argument("number", type=int)
    p.add_argument("--interval", type=float, default=2.0)
    p.add_argument("--max-frames", type=int, default=40)
    args = p.parse_args()

    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    model = os.environ.get("ROBOFLOW_JERSEY_MODEL", "basketball-jersey-numbers-ocr-bimwx/1").strip()
    if not api_key:
        print(json.dumps({"error": "ROBOFLOW_API_KEY missing", "detections": [], "engine": "roboflow"}))
        return 1

    duration = probe_duration(args.video)
    times = []
    t = 0.5
    while t < max(0.5, duration - 0.2) and len(times) < args.max_frames:
        times.append(t)
        t += max(0.5, args.interval)

    detections = []
    with tempfile.TemporaryDirectory() as td:
        for i, ts in enumerate(times):
            frame = Path(td) / f"f_{i:04d}.jpg"
            if not extract_frame(args.video, ts, frame):
                continue
            try:
                raw = call_roboflow(frame, api_key, model)
            except urllib.error.HTTPError as e:
                print(
                    json.dumps(
                        {
                            "error": f"roboflow http {e.code}",
                            "detections": detections,
                            "durationSec": duration,
                            "engine": "roboflow",
                        }
                    )
                )
                return 1
            except Exception as e:
                continue
            preds = raw.get("predictions") or []
            for pred in preds:
                label = str(pred.get("class") or "")
                digits = "".join(ch for ch in label if ch.isdigit())
                if not digits:
                    continue
                num = int(digits[:2])
                if num != args.number:
                    continue
                detections.append(
                    {
                        "timeSec": round(ts, 2),
                        "number": num,
                        "confidence": float(pred.get("confidence") or 0.5),
                    }
                )

    print(
        json.dumps(
            {
                "durationSec": duration,
                "detections": detections,
                "engine": "roboflow",
                "frames": len(times),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
