/**
 * Roboflow hosted inference for jersey / player OCR.
 * Optional — falls back to local Tesseract when ROBOFLOW_API_KEY is unset.
 */

export interface RoboflowPrediction {
  timeSec: number;
  number: number;
  confidence: number;
  xNorm?: number;
  yNorm?: number;
  widthNorm?: number;
  heightNorm?: number;
}

export function isRoboflowConfigured(): boolean {
  return Boolean(process.env.ROBOFLOW_API_KEY?.trim());
}

export function roboflowModelId(): string {
  return (
    process.env.ROBOFLOW_JERSEY_MODEL?.trim() ||
    // Public jersey OCR starter model (basketball digits; still useful for jersey crops)
    "basketball-jersey-numbers-ocr-bimwx/1"
  );
}

function extractNumberFromLabel(label: string): number | null {
  const m = String(label).match(/\d{1,2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= 0 && n <= 99 ? n : null;
}

/** Parse Roboflow detect response into jersey detections. */
export function parseRoboflowPredictions(
  raw: unknown,
  timeSec: number,
  targetNumber?: number,
): RoboflowPrediction[] {
  const root = raw as {
    predictions?: Array<{
      class?: string;
      confidence?: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }>;
    image?: { width?: number; height?: number };
  };
  const preds = root.predictions ?? [];
  const iw = root.image?.width ?? 0;
  const ih = root.image?.height ?? 0;
  const out: RoboflowPrediction[] = [];
  for (const p of preds) {
    const num = extractNumberFromLabel(String(p.class ?? ""));
    if (num == null) continue;
    if (targetNumber != null && num !== targetNumber) continue;
    const conf = typeof p.confidence === "number" ? p.confidence : 0.5;
    out.push({
      timeSec,
      number: num,
      confidence: conf,
      xNorm: iw > 0 && typeof p.x === "number" ? p.x / iw : undefined,
      yNorm: ih > 0 && typeof p.y === "number" ? p.y / ih : undefined,
      widthNorm: iw > 0 && typeof p.width === "number" ? p.width / iw : undefined,
      heightNorm: ih > 0 && typeof p.height === "number" ? p.height / ih : undefined,
    });
  }
  return out;
}

export async function inferRoboflowImage(opts: {
  imageBase64: string;
  apiKey?: string;
  modelId?: string;
}): Promise<unknown> {
  const apiKey = opts.apiKey ?? process.env.ROBOFLOW_API_KEY?.trim();
  if (!apiKey) throw new Error("ROBOFLOW_API_KEY not set");
  const modelId = opts.modelId ?? roboflowModelId();
  const url = `https://detect.roboflow.com/${modelId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: opts.imageBase64,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Roboflow HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
