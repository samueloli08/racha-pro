import { describe, expect, it } from 'vitest';
import { AllTimePlayerStats, MatchRecord, Player } from '../types/racha';
import { computePersonalStats, computeStatsFromHistory, mergeStats } from '../utils/stats';

const PLAYERS: Player[] = [
  { id: 'p-rafa', name: 'Rafa', isGoalkeeper: false, skill: 5, present: true },
  { id: 'p-dudu', name: 'Dudu', isGoalkeeper: false, skill: 4, present: true },
  { id: 'p-beto', name: 'Beto', isGoalkeeper: true, skill: 4, present: true },
  { id: 'p-leo', name: 'Léo', isGoalkeeper: false, skill: 3, present: true },
];

const HISTORY: MatchRecord[] = [
  // Jogo 1: Time A (Rafa, Beto) 2 x 1 Time B (Dudu, Léo) -> Rafa vence
  {
    id: 'm-1',
    teamAName: 'Time Verde',
    teamBName: 'Time Amarelo',
    scoreA: 2,
    scoreB: 1,
    finishedAt: '20:10',
    teamAPlayerIds: ['p-rafa', 'p-beto'],
    teamBPlayerIds: ['p-dudu', 'p-leo'],
    goalkeeperAId: 'p-beto',
    goalkeeperBId: null,
    events: [
      { id: 'g-1', teamId: 'team-1', scorerId: 'p-rafa', assistId: 'p-beto', minuteFormatted: '01:20', timestamp: 1 },
      { id: 'g-2', teamId: 'team-1', scorerId: 'p-rafa', assistId: null, minuteFormatted: '03:00', timestamp: 2 },
      { id: 'g-3', teamId: 'team-2', scorerId: 'p-dudu', assistId: 'p-leo', minuteFormatted: '04:10', timestamp: 3 },
    ],
  },
  // Jogo 2: Time A (Rafa, Beto) 0 x 0 Time B (Dudu, Léo) -> Empate + clean sheet do Beto
  {
    id: 'm-2',
    teamAName: 'Time Verde',
    teamBName: 'Time Amarelo',
    scoreA: 0,
    scoreB: 0,
    finishedAt: '20:20',
    teamAPlayerIds: ['p-rafa', 'p-beto'],
    teamBPlayerIds: ['p-dudu', 'p-leo'],
    goalkeeperAId: 'p-beto',
    goalkeeperBId: null,
    events: [],
  },
  // Jogo 3: Time A (Rafa, Beto) 1 x 2 Time B (Dudu, Léo) -> Rafa perde
  {
    id: 'm-3',
    teamAName: 'Time Verde',
    teamBName: 'Time Amarelo',
    scoreA: 1,
    scoreB: 2,
    finishedAt: '20:30',
    teamAPlayerIds: ['p-rafa', 'p-beto'],
    teamBPlayerIds: ['p-dudu', 'p-leo'],
    goalkeeperAId: 'p-beto',
    goalkeeperBId: null,
    events: [
      { id: 'g-4', teamId: 'team-1', scorerId: 'p-rafa', assistId: null, minuteFormatted: '02:00', timestamp: 4 },
      { id: 'g-5', teamId: 'team-2', scorerId: 'p-dudu', assistId: null, minuteFormatted: '04:00', timestamp: 5 },
      { id: 'g-6', teamId: 'team-2', scorerId: 'own_goal', assistId: null, minuteFormatted: '06:00', timestamp: 6 },
    ],
  },
];

describe('Minhas Estatísticas e compatibilidade com histórico legado', () => {
  it('calcula vitórias, empates, derrotas, gols, assistências, aproveitamento e média de gols', () => {
    const rafa = computePersonalStats('p-rafa', PLAYERS, HISTORY, {}, 4);

    expect(rafa.playerName).toBe('Rafa');
    expect(rafa.matches).toBe(3);
    expect(rafa.presences).toBe(4);
    expect(rafa.goals).toBe(3);
    expect(rafa.assists).toBe(0);
    expect(rafa.wins).toBe(1);
    expect(rafa.draws).toBe(1);
    expect(rafa.losses).toBe(1);
    expect(rafa.legacyUnclassifiedMatches).toBe(0);
    // 1V (3) + 1E (1) + 1D (0) = 4 / 9 = 44.44% -> 44%
    expect(rafa.efficiencyPct).toBe(44);
    expect(rafa.goalsPerMatch).toBe(1);
  });

  it('isola estatísticas exclusivamente para o playerId vinculado sem vazar dados de outros jogadores', () => {
    const dudu = computePersonalStats('p-dudu', PLAYERS, HISTORY, {}, 2);
    expect(dudu.playerId).toBe('p-dudu');
    expect(dudu.goals).toBe(2); // Não soma gol contra nem gols do Rafa
    expect(dudu.wins).toBe(1);
    expect(dudu.draws).toBe(1);
    expect(dudu.losses).toBe(1);

    const beto = computePersonalStats('p-beto', PLAYERS, HISTORY, {}, 3);
    expect(beto.assists).toBe(1);
    expect(beto.goals).toBe(0);
    expect(beto.gkMatches).toBe(3);
    expect(beto.cleanSheets).toBe(1);
    expect(beto.goalsConceded).toBe(3);
  });

  it('preserva dados antigos arquivados (sem draws/losses) sem distorcer o aproveitamento', () => {
    const legacyArchived: Record<string, AllTimePlayerStats> = {
      'p-rafa': {
        name: 'Rafa Antigo',
        goals: 10,
        assists: 5,
        wins: 4,
        matches: 7, // 3 jogos antigos não tinham distinção empate vs derrota
        gkMatches: 0,
        cleanSheets: 0,
        goalsConceded: 0,
      },
    };

    // Ao vincular a conta do usuário ao jogador avulso 'p-rafa', todo o histórico legado é preservado
    const stats = computePersonalStats('p-rafa', PLAYERS, HISTORY, legacyArchived, 6);
    expect(stats.playerName).toBe('Rafa'); // Nome atualizado do cadastro atual
    expect(stats.matches).toBe(10); // 7 legados + 3 hoje
    expect(stats.goals).toBe(13); // 10 + 3
    expect(stats.assists).toBe(5);
    expect(stats.wins).toBe(5); // 4 legados + 1 hoje
    expect(stats.draws).toBe(1); // apenas os registrados
    expect(stats.losses).toBe(1); // apenas os registrados
    expect(stats.legacyUnclassifiedMatches).toBe(3); // 7 - 4 legados sem classificação
    expect(stats.goalsPerMatch).toBe(1.3);
  });

  it('arquiva novos dias preservando draws e losses em mergeStats', () => {
    const dayStats = computeStatsFromHistory(HISTORY, PLAYERS);
    const merged = mergeStats({}, dayStats);
    expect(merged['p-rafa'].wins).toBe(1);
    expect(merged['p-rafa'].draws).toBe(1);
    expect(merged['p-rafa'].losses).toBe(1);
    expect(merged['p-rafa'].matches).toBe(3);
  });
});
