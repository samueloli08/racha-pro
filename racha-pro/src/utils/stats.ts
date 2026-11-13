import { AllTimePlayerStats, MatchRecord, Player, RankingTab } from '../types/racha';

export type StatsMap = Record<string, AllTimePlayerStats>;

export interface RankingRow extends AllTimePlayerStats {
  id: string;
  total: number;
}

const emptyLine = (name: string): AllTimePlayerStats => ({
  name,
  goals: 0,
  assists: 0,
  wins: 0,
  matches: 0,
  gkMatches: 0,
  cleanSheets: 0,
  goalsConceded: 0,
});

/** Calcula as estatísticas individuais a partir do histórico de partidas. */
export function computeStatsFromHistory(history: MatchRecord[], players: Player[]): StatsMap {
  const names = new Map(players.map((p) => [p.id, p.name]));
  const map: StatsMap = {};
  const line = (id: string): AllTimePlayerStats => {
    if (!map[id]) map[id] = emptyLine(names.get(id) ?? 'Jogador');
    return map[id];
  };

  for (const m of history) {
    for (const ev of m.events) {
      if (ev.scorerId !== 'own_goal') line(ev.scorerId).goals += 1;
      if (ev.assistId) line(ev.assistId).assists += 1;
    }

    const aIds = m.teamAPlayerIds ?? [];
    const bIds = m.teamBPlayerIds ?? [];
    aIds.forEach((id) => {
      line(id).matches += 1;
    });
    bIds.forEach((id) => {
      line(id).matches += 1;
    });

    if (m.scoreA > m.scoreB) {
      aIds.forEach((id) => {
        line(id).wins += 1;
      });
    } else if (m.scoreB > m.scoreA) {
      bIds.forEach((id) => {
        line(id).wins += 1;
      });
    }

    if (m.goalkeeperAId) {
      const gk = line(m.goalkeeperAId);
      gk.gkMatches += 1;
      gk.goalsConceded += m.scoreB;
      if (m.scoreB === 0) gk.cleanSheets += 1;
    }
    if (m.goalkeeperBId) {
      const gk = line(m.goalkeeperBId);
      gk.gkMatches += 1;
      gk.goalsConceded += m.scoreA;
      if (m.scoreA === 0) gk.cleanSheets += 1;
    }
  }

  return map;
}

/** Soma dois mapas de estatísticas sem mutar os originais. */
export function mergeStats(base: StatsMap, add: StatsMap): StatsMap {
  const result: StatsMap = {};
  for (const [id, s] of Object.entries(base)) result[id] = { ...emptyLine(s.name), ...s };
  for (const [id, s] of Object.entries(add)) {
    const cur = result[id] ?? emptyLine(s.name);
    result[id] = {
      name: s.name || cur.name,
      goals: cur.goals + s.goals,
      assists: cur.assists + s.assists,
      wins: cur.wins + s.wins,
      matches: cur.matches + s.matches,
      gkMatches: cur.gkMatches + s.gkMatches,
      cleanSheets: cur.cleanSheets + s.cleanSheets,
      goalsConceded: cur.goalsConceded + s.goalsConceded,
    };
  }
  return result;
}

/** Atualiza os nomes com o cadastro atual (caso o jogador tenha sido renomeado). */
export function withCurrentNames(stats: StatsMap, players: Player[]): StatsMap {
  const names = new Map(players.map((p) => [p.id, p.name]));
  const result: StatsMap = {};
  for (const [id, s] of Object.entries(stats)) {
    result[id] = { ...emptyLine(s.name), ...s, name: names.get(id) ?? s.name };
  }
  return result;
}

export function metricOf(row: RankingRow, tab: RankingTab): number {
  switch (tab) {
    case 'goals':
      return row.goals;
    case 'assists':
      return row.assists;
    case 'wins':
      return row.wins;
    default:
      return row.total;
  }
}

export function buildRanking(stats: StatsMap, tab: RankingTab): RankingRow[] {
  const rows: RankingRow[] = Object.entries(stats).map(([id, s]) => ({
    ...s,
    id,
    total: s.goals + s.assists,
  }));

  return rows
    .filter((r) => metricOf(r, tab) > 0)
    .sort((a, b) => {
      const diff = metricOf(b, tab) - metricOf(a, tab);
      if (diff !== 0) return diff;
      if (tab === 'wins') return b.total - a.total || a.matches - b.matches;
      if (tab === 'assists') return b.goals - a.goals;
      return b.goals - a.goals || b.assists - a.assists;
    });
}

/** Ranking de goleiros: mais jogos sem sofrer gol, depois menor média de gols sofridos. */
export function buildGoalkeeperRanking(stats: StatsMap): RankingRow[] {
  return Object.entries(stats)
    .map(([id, s]) => ({ ...s, id, total: s.goals + s.assists }))
    .filter((r) => r.gkMatches > 0)
    .sort(
      (a, b) =>
        b.cleanSheets - a.cleanSheets ||
        a.goalsConceded / a.gkMatches - b.goalsConceded / b.gkMatches
    );
}

export function totalGoalsOf(history: MatchRecord[]): number {
  return history.reduce((acc, m) => acc + m.scoreA + m.scoreB, 0);
}
