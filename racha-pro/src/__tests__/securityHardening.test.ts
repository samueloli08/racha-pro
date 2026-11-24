import { describe, expect, it } from 'vitest';
import { mergeServerAddedPlayers, normalizeState } from '../hooks/useRachaStore';
import { MatchRecord } from '../types/racha';
import { stableStringify } from '../utils/json';
import { computePersonalStats, computeStatsFromHistory, mergeStats } from '../utils/stats';
import { buildLineupText, buildWhatsAppSummary } from '../utils/whatsappFormatter';

describe('Hardening de segurança no cliente', () => {
  it('bloqueia prototype pollution em computeStatsFromHistory, mergeStats e normalizeState', () => {
    const poisonedHistory: MatchRecord[] = [
      {
        id: 'm1',
        teamAName: 'A',
        teamBName: 'B',
        scoreA: 2,
        scoreB: 0,
        finishedAt: '20:00',
        teamAPlayerIds: ['__proto__', 'constructor', 'prototype', 'p-ok'],
        teamBPlayerIds: [],
        goalkeeperAId: '__proto__',
        events: [
          {
            id: 'e1',
            teamId: 't1',
            scorerId: '__proto__',
            assistId: 'constructor',
            minuteFormatted: '01:00',
            timestamp: 1,
          },
          {
            id: 'e2',
            teamId: 't1',
            scorerId: 'p-ok',
            assistId: null,
            minuteFormatted: '02:00',
            timestamp: 2,
          },
        ],
      },
    ];

    const stats = computeStatsFromHistory(poisonedHistory, []);
    expect((Object.prototype as Record<string, unknown>).goals).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).wins).toBeUndefined();
    expect(Object.keys(stats)).toEqual(['p-ok']);

    const merged = mergeStats({}, stats);
    expect(Object.keys(merged)).toEqual(['p-ok']);

    const personal = computePersonalStats('__proto__', [], poisonedHistory, {}, 0);
    expect(personal.goals).toBe(0);
    expect(personal.matches).toBe(0);

    const normalized = normalizeState({
      players: [
        { id: '__proto__', name: 'Evil', skill: 5, present: true },
        { id: 'player-1', name: 'Bom', skill: 4, present: true },
      ],
      history: poisonedHistory,
    });
    expect(normalized.players.map((p) => p.id)).toEqual(['player-1']);
    expect(normalized.history[0].teamAPlayerIds).toEqual(['p-ok']);
    expect(normalized.history[0].goalkeeperAId).toBeUndefined();
    expect(normalized.history[0].events.map((e) => e.scorerId)).toEqual(['p-ok']);
  });

  it('mescla jogadores recém-entrados no servidor sem lost update em conflito de versão', () => {
    const local = normalizeState({
      players: [{ id: 'p-1', name: 'Admin', isGoalkeeper: false, skill: 4, present: true }],
    });
    const server = {
      players: [
        { id: 'p-joined', name: 'Novo Membro', isGoalkeeper: false, skill: 3, present: false },
        { id: 'p-1', name: 'Admin', isGoalkeeper: false, skill: 4, present: false },
      ],
    };

    const merged = mergeServerAddedPlayers(local, server, new Set());
    expect(merged.players.map((p) => p.id)).toEqual(['p-joined', 'p-1']);
    // Mantém alteração local de presença do p-1
    expect(merged.players.find((p) => p.id === 'p-1')?.present).toBe(true);

    // Respeita remoção explícita do admin
    const mergedAfterDelete = mergeServerAddedPlayers(local, server, new Set(['p-joined']));
    expect(mergedAfterDelete.players.map((p) => p.id)).toEqual(['p-1']);
  });

  it('protege stableStringify contra referências circulares e profundidade excessiva', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(stableStringify(cyclic)).toContain('[circular]');

    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 60; i++) deep = { child: deep };
    expect(stableStringify(deep)).toContain('[max-depth]');
  });

  it('sanitiza quebras de linha, caracteres BiDi e markdown no export do WhatsApp', () => {
    const players = [
      { id: 'p1', name: 'Rafa\n*FAKE* \u202E_10_', isGoalkeeper: false, skill: 5, present: true },
    ];
    const teams = [{ id: 't1', name: 'Time *Verde*\r\nFake', color: '#34d399', playerIds: ['p1'] }];
    const lineup = buildLineupText(teams, players);
    expect(lineup).not.toContain('\u202E');
    expect(lineup).toContain('1. Rafa FAKE 10');
    expect(lineup).toContain('*Time Verde Fake*');

    const summary = buildWhatsAppSummary(players, []);
    expect(summary).toContain('RESUMO DO RACHA');
  });
});
