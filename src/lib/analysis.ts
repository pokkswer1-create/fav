import type {
  MatchAnalysis,
  MatchInput,
  PlayerRating,
  PlayerStats,
  TeamInput,
  TeamPower,
  HighlightSuggestion,
} from "./types";

function safeDiv(n: number, d: number): number {
  if (d <= 0) return 0;
  return n / d;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

export function attackEfficiency(p: Pick<PlayerStats, "kills" | "attackErrors" | "attacks">): number {
  return safeDiv(p.kills - p.attackErrors, p.attacks);
}

export function killRate(p: Pick<PlayerStats, "kills" | "attacks">): number {
  return safeDiv(p.kills, p.attacks);
}

export function receptionQuality(p: Pick<PlayerStats, "receptions" | "receptionErrors">): number {
  if (p.receptions <= 0) return 0.75;
  return clamp(1 - safeDiv(p.receptionErrors, p.receptions), 0, 1);
}

export function ratePlayer(player: PlayerStats): PlayerRating {
  const ae = attackEfficiency(player);
  const kr = killRate(player);
  const blockScore = player.blocks * 8;
  const digScore = player.digs * 2.5;
  const servePressure = player.aces * 10 - player.serveErrors * 4;
  const rq = receptionQuality(player);

  const overall = clamp(
    ae * 45 +
      kr * 20 +
      Math.min(blockScore, 18) +
      Math.min(digScore, 12) +
      clamp(servePressure, -8, 14) +
      rq * 12,
  );

  const tags: string[] = [];
  if (ae >= 0.35) tags.push("고효율 공격");
  if (player.blocks >= 4) tags.push("블로킹 위협");
  if (player.aces >= 3) tags.push("서브 압박");
  if (rq >= 0.9 && player.receptions >= 8) tags.push("리시브 안정");
  if (player.attackErrors >= 5) tags.push("공격 실수 주의");
  if (player.digs >= 12) tags.push("디그 머신");
  if (tags.length === 0) tags.push("밸런스형");

  return {
    playerId: player.id,
    name: player.name,
    number: player.number,
    position: player.position,
    attackEfficiency: ae,
    killRate: kr,
    blockScore,
    digScore,
    servePressure,
    receptionQuality: rq,
    overall,
    tags,
  };
}

function aggregateTeam(team: TeamInput): TeamPower {
  const players = team.players;
  const attacks = players.reduce((s, p) => s + p.attacks, 0);
  const kills = players.reduce((s, p) => s + p.kills, 0);
  const attackErrors = players.reduce((s, p) => s + p.attackErrors, 0);
  const blocks = players.reduce((s, p) => s + p.blocks, 0);
  const digs = players.reduce((s, p) => s + p.digs, 0);
  const aces = players.reduce((s, p) => s + p.aces, 0);
  const serveErrors = players.reduce((s, p) => s + p.serveErrors, 0);
  const receptions = players.reduce((s, p) => s + p.receptions, 0);
  const receptionErrors = players.reduce((s, p) => s + p.receptionErrors, 0);
  const sets = players.reduce((s, p) => s + p.sets, 0);
  const setErrors = players.reduce((s, p) => s + p.setErrors, 0);

  const playerRatings = players.map(ratePlayer).sort((a, b) => b.overall - a.overall);
  const ae = safeDiv(kills - attackErrors, attacks);
  const kr = safeDiv(kills, attacks);
  const receptionErrorRate = safeDiv(receptionErrors, Math.max(receptions, 1));
  const setErrorRate = safeDiv(setErrors, Math.max(sets, 1));

  const overall = clamp(
    ae * 50 +
      kr * 18 +
      Math.min(blocks * 2.2, 16) +
      Math.min(aces * 2.5, 12) +
      Math.max(0, 10 - receptionErrorRate * 40) +
      Math.max(0, 8 - setErrorRate * 30) -
      Math.min(serveErrors * 0.8, 6),
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (ae >= 0.3) strengths.push(`공격 효율 ${(ae * 100).toFixed(1)}% — 결정력 우위`);
  else if (ae < 0.18) weaknesses.push(`공격 효율 ${(ae * 100).toFixed(1)}% — 범실·미결정 공격 과다`);

  if (blocks >= 10) strengths.push(`블로킹 ${blocks}점 — 중앙 압박 강함`);
  else if (blocks <= 4) weaknesses.push(`블로킹 ${blocks}점 — 네트 방어 보강 필요`);

  if (aces >= 6) strengths.push(`서브 에이스 ${aces}개 — 사이드아웃 유도`);
  if (serveErrors >= 8) weaknesses.push(`서브 범실 ${serveErrors}개 — 서브 리스크 관리`);

  if (receptionErrorRate <= 0.08) strengths.push("리시브 안정 — 공격 전환 원활");
  else if (receptionErrorRate >= 0.15) weaknesses.push("리시브 흔들림 — 리베로·리시브 라인 조정");

  if (setErrorRate >= 0.08) weaknesses.push("세트 실수 증가 — 토스 선택지 단순화");

  if (strengths.length === 0) strengths.push("특정 강점보다 균형형 전력");
  if (weaknesses.length === 0) weaknesses.push("치명적 약점 없음 — 세트 집중력 유지");

  return {
    teamName: team.name,
    shortName: team.shortName,
    isFav: Boolean(team.isFav),
    attackEfficiency: ae,
    killRate: kr,
    blockPoints: blocks,
    digTotal: digs,
    aceTotal: aces,
    serveErrorTotal: serveErrors,
    receptionErrorRate,
    setErrorRate,
    overall,
    strengths,
    weaknesses,
    keyPlayers: playerRatings.slice(0, 3),
    playerRatings,
  };
}

function setsWon(scores: number[], opp: number[]): number {
  let wins = 0;
  for (let i = 0; i < Math.max(scores.length, opp.length); i += 1) {
    const a = scores[i] ?? 0;
    const b = opp[i] ?? 0;
    if (a > b) wins += 1;
  }
  return wins;
}

function buildMatchupNotes(home: TeamPower, away: TeamPower): string[] {
  const notes: string[] = [];
  const fav = home.isFav ? home : away.isFav ? away : home;
  const opp = fav === home ? away : home;

  if (fav.attackEfficiency > opp.attackEfficiency + 0.05) {
    notes.push(`${fav.shortName} 공격 효율이 ${opp.shortName}보다 뚜렷히 높음 — 오픈·퀵 선택지를 넓히기`);
  } else if (opp.attackEfficiency > fav.attackEfficiency + 0.05) {
    notes.push(`${opp.shortName} 결정력이 우위 — ${fav.shortName}는 블로킹 타이밍·더블블록 우선`);
  }

  if (opp.aceTotal >= fav.aceTotal + 2) {
    notes.push(`상대 서브 압박(${opp.aceTotal}에이스) — 리시브 포메이션을 넓히고 타깃 선수 보호`);
  }

  if (fav.blockPoints >= opp.blockPoints + 3) {
    notes.push(`${fav.shortName} 블로킹 우위 — 미들 블로커 이동을 공격 루트에 연동`);
  }

  const favAce = fav.keyPlayers.find((p) => p.tags.includes("서브 압박"));
  if (favAce) {
    notes.push(`${favAce.name}(#${favAce.number}) 서브 구간을 위기 세트에 배치`);
  }

  if (notes.length === 0) {
    notes.push("양 팀 전력이 팽팽함 — 사이드아웃 성공률과 범실 관리가 승부처");
  }

  return notes;
}

function buildCoachingPlan(fav: TeamPower, opp: TeamPower): string[] {
  const plan: string[] = [];
  const weakAttacker = [...fav.playerRatings]
    .filter((p) => p.position === "OH" || p.position === "OPP")
    .sort((a, b) => a.attackEfficiency - b.attackEfficiency)[0];

  plan.push(
    opp.receptionErrorRate >= 0.12
      ? "상대 리시브가 흔들림 — 플로터·점프플로트 믹스로 리시브 타깃을 고정"
      : "상대 리시브가 안정적 — 서브는 안전 코스 + 가끔 강서브로 템포만 흔들기",
  );

  if (opp.blockPoints >= 8) {
    plan.push("상대 블로킹이 강함 — 파이프·팁·라인 샷으로 블로킹 각을 피하기");
  } else {
    plan.push("상대 블로킹이 약함 — 퀵·A퀵 비중을 높여 초반 점수 리드 확보");
  }

  if (weakAttacker && weakAttacker.attackEfficiency < 0.2) {
    plan.push(
      `${weakAttacker.name} 공격 효율이 낮음 — 세터는 고효율 옵션(${fav.keyPlayers[0]?.name ?? "주공격수"}) 비중을 올리기`,
    );
  }

  plan.push("영상 편집: 킬·블로킹·에이스 클립만 모아 다음 훈련 브리핑용 하이라이트 제작");
  return plan;
}

function buildHighlightSuggestions(fav: TeamPower): HighlightSuggestion[] {
  const suggestions: HighlightSuggestion[] = [
    {
      kind: "kill",
      label: "결정타 킬",
      reason: "공격 성공 장면을 모아 효율 패턴을 공유",
      preferredSeconds: 8,
    },
    {
      kind: "block",
      label: "블로킹 포인트",
      reason: `블로킹 ${fav.blockPoints}점 구간을 컷해 타이밍 피드백`,
      preferredSeconds: 6,
    },
    {
      kind: "ace",
      label: "서브 에이스",
      reason: `에이스 ${fav.aceTotal}개 — 서브 루틴 강화용`,
      preferredSeconds: 5,
    },
    {
      kind: "rally",
      label: "긴 랠리",
      reason: "디그·전환 공격 연결을 보여 팀 수비 자신감 확보",
      preferredSeconds: 12,
    },
  ];
  return suggestions;
}

export function analyzeMatch(match: MatchInput): MatchAnalysis {
  const home = aggregateTeam(match.home);
  const away = aggregateTeam(match.away);
  const homeSets = setsWon(match.home.setScores, match.away.setScores);
  const awaySets = setsWon(match.away.setScores, match.home.setScores);

  let winner: MatchAnalysis["winner"] = "draw";
  if (homeSets > awaySets) winner = "home";
  if (awaySets > homeSets) winner = "away";

  const fav = home.isFav ? home : away.isFav ? away : home;
  const opp = fav === home ? away : home;

  return {
    matchId: match.id,
    title: match.title,
    winner,
    setScore: `${homeSets}-${awaySets}`,
    home,
    away,
    matchupNotes: buildMatchupNotes(home, away),
    coachingPlan: buildCoachingPlan(fav, opp),
    highlightSuggestions: buildHighlightSuggestions(fav),
  };
}

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function scoreLabel(overall: number): string {
  if (overall >= 80) return "S";
  if (overall >= 70) return "A";
  if (overall >= 60) return "B";
  if (overall >= 50) return "C";
  return "D";
}
