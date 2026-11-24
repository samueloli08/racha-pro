import {
  AllTimePlayerStats,
  MatchRecord,
  Player,
  PlayerPersonalStats,
  RankingTab,
} from '../types/racha';

export type StatsMap = Record<string, AllTimePlayerStats>;

export interface RankingRow extends AllTimePlayerStats {
  id: string;
  total: number;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isSafeObjectKey(key: string): boolean {
  return key.length > 0 && key.length <= 80 && !FORBIDDEN_KEYS.has(key);
}

const emptyLine = (name: string): AllTimePlayerStats => ({
  name,
  goals: 0,
  assists: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  matches: 0,
  gkMatches: 0,
  cleanSheets: 0,
  goalsConceded: 0,
});

function createNullProtoMap(): StatsMap {
  return Object.create(null) as StatsMap;
}

/** Calcula as estatísticas individuais a partir do histórico de partidas (imune a prototype pollution). */
export function computeStatsFromHistory(history: MatchRecord[], players: Player[]): StatsMap {
  const names = new Map(players.map((p) => [p.id, p.name]));
  const map = createNullProtoMap();
  const line = (id: string): AllTimePlayerStats | null => {
    if (!isSafeObjectKey(id)) return null;
    if (!Object.prototype.hasOwnProperty.call(map, id)) {
      map[id] = emptyLine(names.get(id) ?? 'Jogador');
    }
    return map[id];
  };

  for (const m of history) {
    for (const ev of m.events) {
      if (ev.scorerId !== 'own_goal') {
        const scorer = line(ev.scorerId);
        if (scorer) scorer.goals += 1;
      }
      if (ev.assistId) {
        const assister = line(ev.assistId);
        if (assister) assister.assists += 1;
      }
    }

    const aIds = m.teamAPlayerIds ?? [];
    const bIds = m.teamBPlayerIds ?? [];
    aIds.forEach((id) => {
      const entry = line(id);
      if (entry) entry.matches += 1;
    });
    bIds.forEach((id) => {
      const entry = line(id);
      if (entry) entry.matches += 1;
    });

    if (m.scoreA > m.scoreB) {
      aIds.forEach((id) => {
        const entry = line(id);
        if (entry) entry.wins += 1;
      });
      bIds.forEach((id) => {
        const cur = line(id);
        if (cur) cur.losses = (cur.losses ?? 0) + 1;
      });
    } else if (m.scoreB > m.scoreA) {
      bIds.forEach((id) => {
        const entry = line(id);
        if (entry) entry.wins += 1;
      });
      aIds.forEach((id) => {
        const cur = line(id);
        if (cur) cur.losses = (cur.losses ?? 0) + 1;
      });
    } else {
      aIds.forEach((id) => {
        const cur = line(id);
        if (cur) cur.draws = (cur.draws ?? 0) + 1;
      });
      bIds.forEach((id) => {
        const cur = line(id);
        if (cur) cur.draws = (cur.draws ?? 0) + 1;
      });
    }

    if (m.goalkeeperAId) {
      const gk = line(m.goalkeeperAId);
      if (gk) {
        gk.gkMatches += 1;
        gk.goalsConceded += m.scoreB;
        if (m.scoreB === 0) gk.cleanSheets += 1;
      }
    }
    if (m.goalkeeperBId) {
      const gk = line(m.goalkeeperBId);
      if (gk) {
        gk.gkMatches += 1;
        gk.goalsConceded += m.scoreA;
        if (m.scoreA === 0) gk.cleanSheets += 1;
      }
    }
  }

  return map;
}

/** Soma dois mapas de estatísticas sem mutar os originais (compatível com dados antigos). */
export function mergeStats(base: StatsMap, add: StatsMap): StatsMap {
  const result = createNullProtoMap();
  for (const [id, s] of Object.entries(base)) {
    if (!isSafeObjectKey(id)) continue;
    result[id] = {
      ...emptyLine(s.name),
      ...s,
      draws: s.draws ?? 0,
      losses: s.losses ?? 0,
    };
  }
  for (const [id, s] of Object.entries(add)) {
    if (!isSafeObjectKey(id)) continue;
    const cur = Object.prototype.hasOwnProperty.call(result, id)
      ? result[id]
      : emptyLine(s.name);
    result[id] = {
      name: s.name || cur.name,
      goals: cur.goals + s.goals,
      assists: cur.assists + s.assists,
      wins: cur.wins + s.wins,
      draws: (cur.draws ?? 0) + (s.draws ?? 0),
      losses: (cur.losses ?? 0) + (s.losses ?? 0),
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
  const result = createNullProtoMap();
  for (const [id, s] of Object.entries(stats)) {
    if (!isSafeObjectKey(id)) continue;
    result[id] = {
      ...emptyLine(s.name),
      ...s,
      draws: s.draws ?? 0,
      losses: s.losses ?? 0,
      name: names.get(id) ?? s.name,
    };
  }
  return result;
}

/**
 * Calcula "Minhas Estatísticas" exclusivamente para um playerId específico,
 * combinando partidas do dia (history), acumulado histórico (allTimeStats)
 * e presenças confirmadas em sessões (confirmedPresences).
 */
export function computePersonalStats(
  playerId: string,
  players: Player[],
  history: MatchRecord[],
  allTimeStats: Record<string, AllTimePlayerStats>,
  confirmedPresences = 0
): PlayerPersonalStats {
  const safeId = isSafeObjectKey(playerId) ? playerId : '';
  const player = safeId ? players.find((p) => p.id === safeId) : undefined;
  const todayMap = computeStatsFromHistory(history, players);
  const today =
    safeId && Object.prototype.hasOwnProperty.call(todayMap, safeId) ? todayMap[safeId] : undefined;
  const archived =
    safeId && Object.prototype.hasOwnProperty.call(allTimeStats, safeId)
      ? allTimeStats[safeId]
      : undefined;

  const goals = (archived?.goals ?? 0) + (today?.goals ?? 0);
  const assists = (archived?.assists ?? 0) + (today?.assists ?? 0);
  const wins = (archived?.wins ?? 0) + (today?.wins ?? 0);
  const draws = (archived?.draws ?? 0) + (today?.draws ?? 0);
  const losses = (archived?.losses ?? 0) + (today?.losses ?? 0);
  const matches = (archived?.matches ?? 0) + (today?.matches ?? 0);
  const gkMatches = (archived?.gkMatches ?? 0) + (today?.gkMatches ?? 0);
  const cleanSheets = (archived?.cleanSheets ?? 0) + (today?.cleanSheets ?? 0);
  const goalsConceded = (archived?.goalsConceded ?? 0) + (today?.goalsConceded ?? 0);

  const classifiedMatches = wins + draws + losses;
  const legacyUnclassifiedMatches = Math.max(0, matches - classifiedMatches);

  const efficiencyPct =
    classifiedMatches > 0
      ? Math.min(100, Math.max(0, Math.round(((wins * 3 + draws) / (classifiedMatches * 3)) * 100)))
      : null;

  const goalsPerMatch = matches > 0 ? Number((goals / matches).toFixed(2)) : 0;

  return {
    playerId: safeId,
    playerName: player?.name ?? archived?.name ?? today?.name ?? 'Jogador',
    matches,
    presences: Math.max(0, confirmedPresences),
    goals,
    assists,
    wins,
    draws,
    losses,
    legacyUnclassifiedMatches,
    efficiencyPct,
    goalsPerMatch,
    gkMatches,
    cleanSheets,
    goalsConceded,
  };
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
  const rows: RankingRow[] = Object.entries(stats)
    .filter(([id]) => isSafeObjectKey(id))
    .map(([id, s]) => ({
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
    .filter(([id]) => isSafeObjectKey(id))
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
