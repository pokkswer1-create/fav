"use client";

import { useMemo } from "react";
import { pct } from "@/lib/analysis";
import type { ScoutSession } from "@/lib/scout";
import {
  analyzeRotations,
  attackZoneCounts,
  setterDistribution,
  skillEfficiency,
  skillPercent,
  SKILL_LABELS,
  ZONE_LABELS,
  type CourtZone,
  type VolleySkill,
} from "@/lib/volley-codes";

const SKILLS: VolleySkill[] = ["S", "R", "A", "B", "E", "D", "F"];
const ZONE_ORDER: CourtZone[] = [4, 3, 2, 7, 8, 9, 5, 6, 1];

export function ProStatsPanels({
  scout,
  homeName,
  awayName,
}: {
  scout: ScoutSession | null | undefined;
  homeName: string;
  awayName: string;
}) {
  const actions = scout?.actions ?? [];
  const points = scout?.points ?? [];

  const homeRot = useMemo(() => analyzeRotations(points, "home"), [points]);
  const awayRot = useMemo(() => analyzeRotations(points, "away"), [points]);
  const homeActs = useMemo(() => actions.filter((a) => a.team === "home"), [actions]);
  const awayActs = useMemo(() => actions.filter((a) => a.team === "away"), [actions]);
  const setterHome = useMemo(() => setterDistribution(homeActs), [homeActs]);
  const zonesHome = useMemo(() => attackZoneCounts(homeActs), [homeActs]);
  const maxZone = Math.max(1, ...Object.values(zonesHome));

  if (!points.length && !actions.length) {
    return (
      <section className="notes-block">
        <h3>VolleyStation / DataVolley 통계</h3>
        <p className="hint">프로 코딩·로테이션 기록이 있으면 사이드아웃·세터분포·존 히트맵이 표시됩니다.</p>
      </section>
    );
  }

  return (
    <>
      <section className="notes-block">
        <h3>로테이션 사이드아웃 / 브레이크</h3>
        <div className="rot-compare">
          <RotationTable title={homeName} rows={homeRot} />
          <RotationTable title={awayName} rows={awayRot} />
        </div>
      </section>

      {homeActs.length || awayActs.length ? (
        <section className="notes-block">
          <h3>스킬 효율 (VSEFF)</h3>
          <div className="rot-compare">
            <SkillEffTable title={homeName} actions={homeActs} />
            <SkillEffTable title={awayName} actions={awayActs} />
          </div>
        </section>
      ) : null}

      {setterHome.length ? (
        <section className="notes-block">
          <h3>세터 분포 ({homeName})</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>콤비</th>
                <th>시도</th>
                <th>킬</th>
                <th>범실</th>
                <th>효율</th>
              </tr>
            </thead>
            <tbody>
              {setterHome.map((r) => (
                <tr key={r.combination}>
                  <td>{r.combination}</td>
                  <td>{r.attempts}</td>
                  <td>{r.kills}</td>
                  <td>{r.errors}</td>
                  <td>{pct(r.efficiency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {homeActs.some((a) => a.skill === "A" && a.endZone) ? (
        <section className="notes-block">
          <h3>공격 존 히트맵 ({homeName})</h3>
          <div className="zone-heat-grid" aria-label="공격 종료 존">
            {ZONE_ORDER.map((z) => {
              const n = zonesHome[z];
              const intensity = n / maxZone;
              return (
                <div
                  key={z}
                  className="zone-heat-cell"
                  style={{
                    background: `rgba(255, 45, 149, ${0.08 + intensity * 0.55})`,
                  }}
                >
                  <strong>{z}</strong>
                  <span>{ZONE_LABELS[z]}</span>
                  <em>{n}</em>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

function RotationTable({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof analyzeRotations>;
}) {
  return (
    <div>
      <h4>{title}</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>P</th>
            <th>SO</th>
            <th>BP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rotation}>
              <td>P{r.rotation}</td>
              <td>
                {pct(r.sideOutRate)}
                <small>
                  {" "}
                  ({r.sideOutWins}/{r.sideOutAttempts})
                </small>
              </td>
              <td>
                {pct(r.breakRate)}
                <small>
                  {" "}
                  ({r.breakWins}/{r.breakAttempts})
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkillEffTable({
  title,
  actions,
}: {
  title: string;
  actions: NonNullable<ScoutSession["actions"]>;
}) {
  return (
    <div>
      <h4>{title}</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>스킬</th>
            <th>효율</th>
            <th>#%</th>
            <th>n</th>
          </tr>
        </thead>
        <tbody>
          {SKILLS.map((s) => {
            const n = actions.filter((a) => a.skill === s).length;
            if (!n) return null;
            return (
              <tr key={s}>
                <td>
                  {s} {SKILL_LABELS[s]}
                </td>
                <td>{pct(skillEfficiency(actions, s))}</td>
                <td>{pct(skillPercent(actions, s, "#"))}</td>
                <td>{n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
