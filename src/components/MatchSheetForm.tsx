import type { MatchInput, PlayerStats, Position, TeamInput } from "@/lib/types";

const POSITIONS: Position[] = ["OH", "OPP", "MB", "S", "L", "U"];

const STAT_FIELDS: Array<{ key: keyof PlayerStats; label: string; min?: number }> = [
  { key: "attacks", label: "공격" },
  { key: "kills", label: "킬" },
  { key: "attackErrors", label: "공격실수" },
  { key: "blocks", label: "블로킹" },
  { key: "digs", label: "디그" },
  { key: "aces", label: "에이스" },
  { key: "serveErrors", label: "서브실수" },
  { key: "receptions", label: "리시브" },
  { key: "receptionErrors", label: "리시브실수" },
  { key: "sets", label: "세트" },
  { key: "setErrors", label: "세트실수" },
];

function num(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function TeamSheet({
  side,
  team,
  onChange,
}: {
  side: "home" | "away";
  team: TeamInput;
  onChange: (next: TeamInput) => void;
}) {
  function patchPlayer(id: string, patch: Partial<PlayerStats>) {
    onChange({
      ...team,
      players: team.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function addPlayer() {
    const nextNum =
      team.players.reduce((m, p) => Math.max(m, p.number), 0) + 1 || team.players.length + 1;
    onChange({
      ...team,
      players: [
        ...team.players,
        {
          id: `${side}-${crypto.randomUUID().slice(0, 8)}`,
          name: "새 선수",
          number: nextNum,
          position: "OH",
          attacks: 0,
          kills: 0,
          attackErrors: 0,
          blocks: 0,
          digs: 0,
          aces: 0,
          serveErrors: 0,
          receptions: 0,
          receptionErrors: 0,
          sets: 0,
          setErrors: 0,
        },
      ],
    });
  }

  return (
    <section className="sheet-team">
      <div className="sheet-team-head">
        <label>
          팀명
          <input
            value={team.name}
            onChange={(e) =>
              onChange({
                ...team,
                name: e.target.value,
                shortName: e.target.value.slice(0, 6) || team.shortName,
              })
            }
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(team.isFav)}
            onChange={(e) => onChange({ ...team, isFav: e.target.checked })}
          />
          FAV
        </label>
        <label>
          세트점수 (쉼표)
          <input
            value={team.setScores.join(",")}
            onChange={(e) =>
              onChange({
                ...team,
                setScores: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => num(s)),
              })
            }
          />
        </label>
      </div>

      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th>#</th>
              <th>이름</th>
              <th>포지션</th>
              {STAT_FIELDS.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {team.players.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    className="narrow"
                    value={p.number}
                    onChange={(e) => patchPlayer(p.id, { number: num(e.target.value, p.number) })}
                  />
                </td>
                <td>
                  <input
                    value={p.name}
                    onChange={(e) => patchPlayer(p.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={p.position}
                    onChange={(e) => patchPlayer(p.id, { position: e.target.value as Position })}
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </td>
                {STAT_FIELDS.map((f) => (
                  <td key={f.key}>
                    <input
                      className="narrow"
                      value={String(p[f.key] ?? 0)}
                      onChange={(e) =>
                        patchPlayer(p.id, {
                          [f.key]: num(e.target.value, Number(p[f.key] ?? 0)),
                        } as Partial<PlayerStats>)
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() =>
                      onChange({ ...team, players: team.players.filter((x) => x.id !== p.id) })
                    }
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn ghost" onClick={addPlayer}>
        선수 추가
      </button>
    </section>
  );
}

export function MatchSheetForm({
  match,
  onChange,
}: {
  match: MatchInput;
  onChange: (next: MatchInput) => void;
}) {
  return (
    <div className="match-sheet">
      <div className="sheet-meta">
        <label>
          경기명
          <input
            value={match.title}
            onChange={(e) => onChange({ ...match, title: e.target.value })}
          />
        </label>
        <label>
          날짜
          <input
            type="date"
            value={match.date}
            onChange={(e) => onChange({ ...match, date: e.target.value })}
          />
        </label>
        <label>
          장소
          <input
            value={match.venue}
            onChange={(e) => onChange({ ...match, venue: e.target.value })}
          />
        </label>
      </div>

      <h3 className="sheet-side-title">HOME</h3>
      <TeamSheet
        side="home"
        team={match.home}
        onChange={(home) => onChange({ ...match, home })}
      />

      <h3 className="sheet-side-title">AWAY</h3>
      <TeamSheet
        side="away"
        team={match.away}
        onChange={(away) => onChange({ ...match, away })}
      />
    </div>
  );
}
