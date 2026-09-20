/**
 * FIVB VIS (Volleyball Information System) public read client.
 * Endpoint: https://www.fivb.org/Vis2009/XmlRequest.asmx
 */

export interface FivbTournament {
  no: number;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
}

export interface FivbMatchSummary {
  no: number;
  name?: string;
  teamA?: string;
  teamB?: string;
  date?: string;
  status?: string;
}

const FIVB_URL = "https://www.fivb.org/Vis2009/XmlRequest.asmx";

export async function fivbRequest(xml: string, timeoutMs = 20_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new URLSearchParams({ Request: xml });
    const res = await fetch(FIVB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`FIVB VIS HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1]] = m[2];
  return out;
}

export function parseTournamentListXml(xml: string): FivbTournament[] {
  const list: FivbTournament[] = [];
  const re = /<VolleyballTournament\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const a = attrs(m[1]);
    list.push({
      no: Number(a.No ?? 0),
      name: a.Name ?? "",
      code: a.Code ?? "",
      startDate: a.StartDate ?? "",
      endDate: a.EndDate ?? "",
    });
  }
  return list.filter((t) => t.no > 0 && t.name);
}

export async function listFivbTournaments(opts?: {
  nameContains?: string;
  limit?: number;
}): Promise<FivbTournament[]> {
  const xml = `<Request Type="GetVolleyTournamentList" Fields="No Name Code StartDate EndDate"><Filter /></Request>`;
  const raw = await fivbRequest(xml);
  let list = parseTournamentListXml(raw);
  const q = opts?.nameContains?.trim().toLowerCase();
  if (q) list = list.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  // Prefer recent / named events first
  list.sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  return list.slice(0, opts?.limit ?? 40);
}

export async function listFivbMatches(tournamentNo: number, limit = 30): Promise<FivbMatchSummary[]> {
  const xml = `<Request Type="GetVolleyMatchList" Fields="No TeamAName TeamBName LocalDate Status Name"><Filter NoTournament="${tournamentNo}" /></Request>`;
  const raw = await fivbRequest(xml);
  const list: FivbMatchSummary[] = [];
  const re = /<VolleyballMatch\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const a = attrs(m[1]);
    list.push({
      no: Number(a.No ?? 0),
      name: a.Name,
      teamA: a.TeamAName,
      teamB: a.TeamBName,
      date: a.LocalDate,
      status: a.Status,
    });
  }
  return list.filter((x) => x.no > 0).slice(0, limit);
}

export async function getFivbMatchStats(matchNo: number): Promise<{
  matchNo: number;
  rawSnippet: string;
  playerRows: Array<Record<string, string>>;
}> {
  const xml = `<Request Type="GetVolleyStatisticList" Fields="NoPlayer Name TeamName SpikePoints BlockPoints ServePoints"><Filter NoMatch="${matchNo}" /><Include>Players</Include><SumBy>Match</SumBy></Request>`;
  const raw = await fivbRequest(xml, 30_000);
  const playerRows: Array<Record<string, string>> = [];
  const re = /<(?:VolleyballStatistic|Statistic)\b([^>]*)\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    playerRows.push(attrs(m[1]));
  }
  // Also try nested tags
  if (!playerRows.length) {
    const alt = /<Player\b([^>]*)\/>/gi;
    while ((m = alt.exec(raw))) playerRows.push(attrs(m[1]));
  }
  return {
    matchNo,
    rawSnippet: raw.slice(0, 1500),
    playerRows: playerRows.slice(0, 80),
  };
}
