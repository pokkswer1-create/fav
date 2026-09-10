"use client";

import { useState } from "react";
import {
  COMMON_COMBOS,
  EFFECT_LABELS,
  SKILL_LABELS,
  ZONE_LABELS,
  type CourtZone,
  type RotationId,
  type VolleyEffect,
  type VolleySkill,
} from "@/lib/volley-codes";

const SKILLS: VolleySkill[] = ["S", "R", "A", "B", "E", "D", "F"];
const EFFECTS: VolleyEffect[] = ["#", "+", "!", "-", "/", "="];
const ZONES: CourtZone[] = [4, 3, 2, 7, 8, 9, 5, 6, 1];

export interface SkillCodeDraft {
  skill: VolleySkill;
  effect: VolleyEffect;
  endZone?: CourtZone;
  combination?: string;
  pointEnding: boolean;
}

export function SkillCodePad({
  value,
  onChange,
  rotation,
  onRotationChange,
}: {
  value: SkillCodeDraft;
  onChange: (next: SkillCodeDraft) => void;
  rotation: RotationId;
  onRotationChange: (r: RotationId) => void;
}) {
  return (
    <section className="skill-code-pad">
      <div className="skill-code-head">
        <h3>프로 코딩 (DataVolley/VolleyStation)</h3>
        <label>
          로테이션 P
          <select
            value={rotation}
            onChange={(e) => onRotationChange(Number(e.target.value) as RotationId)}
          >
            {[1, 2, 3, 4, 5, 6].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="hint">스킬 → 퀄리티(#/+ /!/-//=) → 존 → (공격 시) 콤비</p>

      <div className="skill-row">
        {SKILLS.map((s) => (
          <button
            key={s}
            type="button"
            className={`btn scout-btn ${value.skill === s ? "is-active" : ""}`}
            onClick={() => onChange({ ...value, skill: s })}
          >
            {s}
            <span>{SKILL_LABELS[s]}</span>
          </button>
        ))}
      </div>

      <div className="skill-row">
        {EFFECTS.map((e) => (
          <button
            key={e}
            type="button"
            className={`btn scout-btn effect ${value.effect === e ? "is-active" : ""}`}
            onClick={() => onChange({ ...value, effect: e })}
            title={EFFECT_LABELS[e]}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="zone-grid">
        {ZONES.map((z) => (
          <button
            key={z}
            type="button"
            className={`btn ghost zone-btn ${value.endZone === z ? "is-active" : ""}`}
            onClick={() => onChange({ ...value, endZone: z })}
          >
            {z}
            <em>{ZONE_LABELS[z]}</em>
          </button>
        ))}
      </div>

      {value.skill === "A" ? (
        <div className="skill-row wrap">
          {COMMON_COMBOS.map((c) => (
            <button
              key={c}
              type="button"
              className={`btn ghost ${value.combination === c ? "is-active" : ""}`}
              onClick={() => onChange({ ...value, combination: c })}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      <label className="follow-toggle">
        <input
          type="checkbox"
          checked={value.pointEnding}
          onChange={(e) => onChange({ ...value, pointEnding: e.target.checked })}
        />
        이 액션으로 포인트 종료
      </label>
    </section>
  );
}

export function useDefaultSkillDraft(): [SkillCodeDraft, (n: SkillCodeDraft) => void] {
  const [draft, setDraft] = useState<SkillCodeDraft>({
    skill: "A",
    effect: "#",
    pointEnding: true,
    combination: "X5",
  });
  return [draft, setDraft];
}

export function skillDraftSummary(d: SkillCodeDraft): string {
  return `${d.skill}${d.effect}${d.endZone ? ` Z${d.endZone}` : ""}${
    d.combination ? ` ${d.combination}` : ""
  }${d.pointEnding ? " · POINT" : ""}`;
}
