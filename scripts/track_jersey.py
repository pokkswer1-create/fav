#!/usr/bin/env python3
"""Sample video frames and OCR jersey numbers."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import cv2
import pytesseract


def parse_numbers(text: str) -> set[int]:
    found: set[int] = set()
    for token in re.findall(r"\d{1,2}", text or ""):
        n = int(token)
        if 0 < n < 100:
            found.add(n)
    return found


def detect(video_path: str, target: int, interval: float) -> dict:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if fps > 0 else 0.0
    step = max(1, int(round(fps * interval)))

    detections: list[dict] = []
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step != 0:
            idx += 1
            continue

        t = idx / fps
        h, w = frame.shape[:2]
        # Focus on torso / center-court where jersey digits are drawn in demo.
        y0, y1 = int(h * 0.28), int(h * 0.72)
        x0, x1 = int(w * 0.28), int(w * 0.72)
        rois = [
            frame[y0:y1, x0:x1],
            frame[int(h * 0.2) : int(h * 0.8), int(w * 0.15) : int(w * 0.85)],
            frame[int(h * 0.35) : int(h * 0.65), int(w * 0.35) : int(w * 0.65)],
        ]
        numbers: set[int] = set()
        best_conf = 0.0
        configs = [
            "--psm 7 -c tessedit_char_whitelist=0123456789",
            "--psm 6 -c tessedit_char_whitelist=0123456789",
            "--psm 8 -c tessedit_char_whitelist=0123456789",
        ]
        for roi in rois:
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
            blur = cv2.GaussianBlur(gray, (3, 3), 0)
            variants = [
                cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
                cv2.adaptiveThreshold(
                    blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 5
                ),
            ]
            for thr in variants:
                for cfg in configs:
                    text = pytesseract.image_to_string(thr, config=cfg)
                    found = parse_numbers(text)
                    numbers |= found
                    if target in found:
                        best_conf = max(best_conf, 0.85)
                        break
                if target in numbers:
                    break
            if target in numbers:
                break

        if target in numbers:
            detections.append(
                {
                    "timeSec": round(float(t), 2),
                    "number": target,
                    "confidence": best_conf or 0.7,
                }
            )

        idx += 1

    cap.release()
    return {
        "durationSec": round(duration, 2),
        "target": target,
        "intervalSec": interval,
        "detections": detections,
        "engine": "tesseract-ocr",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("number", type=int)
    parser.add_argument("--interval", type=float, default=0.5)
    args = parser.parse_args()
    if not Path(args.video).exists():
        print(json.dumps({"error": f"missing video: {args.video}"}))
        return 1
    try:
        result = detect(args.video, args.number, args.interval)
        print(json.dumps(result))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
