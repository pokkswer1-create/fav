"use client";

import type { TeamHeatmap } from "@/lib/heatmap";
import { zoneGridMeta } from "@/lib/heatmap";

const META = zoneGridMeta();

function heatColor(value: number, isFav: boolean): string {
  const v = Math.max(0, Math.min(1, value));
  if (isFav) {
    const r = Math.round(80 + v * 175);
    const g = Math.round(20 + v * 25);
    const b = Math.round(60 + v * 90);
    return `rgba(${r},${g},${b},${0.25 + v * 0.7})`;
  }
  const g = Math.round(90 + v * 120);
  const r = Math.round(40 + v * 40);
  const b = Math.round(50 + v * 30);
  return `rgba(${r},${g},${b},${0.22 + v * 0.65})`;
}

export function CourtHeatmap({ heat }: { heat: TeamHeatmap }) {
  const byId = Object.fromEntries(heat.zones.map((z) => [z.id, z]));

  return (
    <article className={`court-heat ${heat.isFav ? "is-fav" : ""}`}>
      <header>
        <h4>{heat.teamName} 코트 히트맵</h4>
        <p>
          핫존 {heat.hotZones.map((id) => META[id].label).join(" · ")}
        </p>
      </header>
      <div className="court-board" role="img" aria-label={`${heat.teamName} 코트 활동 히트맵`}>
        <div className="court-net">NET</div>
        <div className="court-grid">
          {(["LF", "MF", "RF", "LB", "MB", "RB"] as const).map((id) => {
            const zone = byId[id];
            return (
              <div
                key={id}
                className="court-cell"
                style={{ background: heatColor(zone?.value ?? 0, heat.isFav) }}
                title={`${zone?.label ?? id}: ${Math.round((zone?.value ?? 0) * 100)}%`}
              >
                <strong>{zone?.label ?? id}</strong>
                <span>{Math.round((zone?.value ?? 0) * 100)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
