"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeMatch, pct } from "@/lib/analysis";
import { createDemoScoutSession } from "@/lib/demo-scout";
import {
  analyzeSideOut,
  buildMatchFromScout,
  computeSetScores,
  emptyPlayer,
  type ScoutSession,
} from "@/lib/scout";
import {
  analyzeRotations,
  skillEfficiency,
  skillPercent,
  setterDistribution,
} from "@/lib/volley-codes";
import {
  getCustomRosters,
  getScoutSession,
  listScoutSessions,
  saveScoutSession,
} from "@/lib/storage";
import { buildDvwExport, downloadDvw } from "@/lib/dvw-export";
import { buildMarkdownReport, downloadTextFile } from "@/lib/report";
import { demoMatch } from "@/lib/demo-match";
import type { PlayerStats, Position } from "@/lib/types";
import { WingLogo } from "./SiteHeader";
import { ProStatsPanels } from "./ProStatsPanels";

function toPlayers(
  list: Array<{ id: string; name: string; number: number; position: string }>,
): PlayerStats[] {
  return list.map((p) =>
    emptyPlayer({
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position as Position,
    }),
  );
}

export function BenchWorkbench() {
  const router = useRouter();
  const [session, setSession] = useState<ScoutSession>(() => {
    const listed = listScoutSessions();
    return listed[0] ?? getScoutSession("demo-scout-session") ?? createDemoScoutSession();
  });
  const [status, setStatus] = useState<string | null>(null);

  const sets = useMemo(() => computeSetScores(session.points), [session.points]);
  const side = useMemo(() => analyzeSideOut(session.points), [session.points]);
  const homeRot = useMemo(() => analyzeRotations(session.points, "home"), [session.points]);
  const bestRot = useMemo(() => {
    const withAttempts = homeRot.filter((r) => r.sideOutAttempts + r.breakAttempts > 0);
    if (!withAttempts.length) return null;
    return [...withAttempts].sort(
      (a, b) => b.sideOutRate + b.breakRate - (a.sideOutRate + a.breakRate),
    )[0];
  }, [homeRot]);
  const homeActs = useMemo(
    () => (session.actions ?? []).filter((a) => a.team === "home"),
    [session.actions],
  );
  const attackEff = skillEfficiency(homeActs, "A");
  const killPct = skillPercent(homeActs, "A", "#");
  const topCombo = setterDistribution(homeActs)[0];

  function refreshFromStorage() {
    const next =
      getScoutSession(session.id) ??
      getScoutSession(session.matchId) ??
      listScoutSessions()[0];
    if (next) {
      setSession(next);
      setStatus("스카우트 세션 새로고침");
    } else {
      setStatus("저장된 스카우트가 없습니다");
    }
  }

  function loadDemo() {
    const demo = createDemoScoutSession();
    saveScoutSession(demo);
    setSession(demo);
    setStatus("데모 스카우트 (코딩 포함)");
  }

  function exportDvw() {
    const text = buildDvwExport({
      homeName: session.homeName,
      awayName: session.awayName,
      date: new Date().toISOString().slice(0, 10),
      actions: session.actions ?? [],
    });
    downloadDvw(`${session.homeName}-bench`, text);
    setStatus("DVW 내보내기");
  }

  function exportReport() {
    const rosters = getCustomRosters();
    const home = toPlayers(rosters?.home ?? demoMatch.home.players.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position,
    })));
    const away = toPlayers(rosters?.away ?? demoMatch.away.players.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position,
    })));
    const match = buildMatchFromScout(session, { home, away });
    const analysis = analyzeMatch(match);
    const md = buildMarkdownReport(match, analysis, session);
    downloadTextFile(`${session.homeName}-bench-report.md`, md, "text/markdown");
    setStatus("벤치 리포트 MD");
  }

  const current = sets[sets.length - 1] ?? { home: 0, away: 0, setIndex: 0 };

  return (
    <div className="workbench bench-mode">
      <section className="workbench-intro">
        <p className="eyebrow">BENCH LIVE</p>
        <h1>벤치 모드</h1>
        <p className="lede">
          태블릿용 라이브 보드 — 사이드아웃·로테이션·공격효율을 한눈에 보고 DVW/리포트를 내보냅니다.
        </p>
      </section>

      <div className="bench-hero">
        <WingLogo size={64} />
        <div>
          <p className="eyebrow">{session.title}</p>
          <h2>
            {session.homeName} {current.home} – {current.away} {session.awayName}
          </h2>
          <p>
            로테이션 P{session.homeRotation ?? 1} / P{session.awayRotation ?? 1} · 액션{" "}
            {session.actions?.length ?? 0} · 포인트 {session.points.length}
          </p>
        </div>
      </div>

      <div className="bench-kpi">
        <div>
          <span>사이드아웃</span>
          <strong>{pct(side.homeSideOutRate)}</strong>
        </div>
        <div>
          <span>어웨이 SO</span>
          <strong>{pct(side.awaySideOutRate)}</strong>
        </div>
        <div>
          <span>공격효율</span>
          <strong>{pct(attackEff)}</strong>
        </div>
        <div>
          <span>킬%</span>
          <strong>{pct(killPct)}</strong>
        </div>
        <div>
          <span>베스트 P</span>
          <strong>{bestRot ? `P${bestRot.rotation}` : "—"}</strong>
        </div>
        <div>
          <span>탑 콤비</span>
          <strong>{topCombo ? topCombo.combination : "—"}</strong>
        </div>
      </div>

      <div className="pane-actions">
        <button type="button" className="btn ghost" onClick={refreshFromStorage}>
          새로고침
        </button>
        <button type="button" className="btn ghost" onClick={loadDemo}>
          데모
        </button>
        <button type="button" className="btn ghost" onClick={exportDvw}>
          DVW
        </button>
        <button type="button" className="btn ghost" onClick={exportReport}>
          리포트 MD
        </button>
        <button type="button" className="btn primary" onClick={() => router.push("/scout")}>
          스카우트 코딩
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => router.push(`/analyze?match=${encodeURIComponent(session.matchId)}`)}
        >
          전력분석
        </button>
      </div>

      {status ? <p className="status-line">{status}</p> : null}

      <ProStatsPanels
        scout={session}
        homeName={session.homeName}
        awayName={session.awayName}
      />
    </div>
  );
}
