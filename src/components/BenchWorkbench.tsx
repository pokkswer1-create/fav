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
import { ExplainedButton, HowToPanel } from "./UiGuide";

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
          사이드아웃·로테이션·공격효율을 한눈에 보는 보드입니다. 코딩은 스카우트에서 하세요.
        </p>
      </section>

      <HowToPanel
        title="벤치 보드 사용법"
        steps={[
          "① 데모 — 연습용 스카우트 통계를 불러옵니다.",
          "② 위 KPI와 로테이션·효율 표를 확인합니다.",
          "③ 필요하면 DVW/리포트를 받거나 스카우트·분석으로 이동합니다.",
        ]}
      />

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

      <div className="action-simple">
        <ExplainedButton
          variant="primary"
          label="데모"
          hint="연습용 스카우트 통계를 불러옵니다"
          onClick={loadDemo}
        />
        <ExplainedButton
          label="새로고침"
          hint="저장된 최신 스카우트 세션을 다시 읽습니다"
          onClick={refreshFromStorage}
        />
        <ExplainedButton
          variant="primary"
          label="전력분석"
          hint="이 경기 분석 화면으로 이동합니다"
          onClick={() => router.push(`/analyze?match=${encodeURIComponent(session.matchId)}`)}
        />
        <ExplainedButton
          label="스카우트 코딩"
          hint="기록을 남기러 스카우트 화면으로 갑니다"
          onClick={() => router.push("/scout")}
        />
      </div>
      <div className="action-simple secondary">
        <ExplainedButton label="DVW" hint="DataVolley 스타일 텍스트를 내보냅니다" onClick={exportDvw} />
        <ExplainedButton
          label="리포트 MD"
          hint="마크다운 리포트 파일을 받습니다"
          onClick={exportReport}
        />
      </div>

      {status ? <p className="status-line status-flash">{status}</p> : null}

      <ProStatsPanels
        scout={session}
        homeName={session.homeName}
        awayName={session.awayName}
      />
    </div>
  );
}
