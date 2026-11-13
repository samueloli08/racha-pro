import { MatchRecord, Player, Team } from '../types/racha';
import { RankingRow } from './stats';

const COLOR_EMOJI: Record<string, string> = {
  '#10b981': '🟢',
  '#f59e0b': '🟡',
  '#3b82f6': '🔵',
  '#ef4444': '🔴',
  '#a855f7': '🟣',
  '#e4e4e7': '⚪',
};

export function colorToEmoji(hex: string): string {
  return COLOR_EMOJI[hex.toLowerCase()] ?? '⚫';
}

const medalFor = (idx: number): string =>
  idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';

export function buildWhatsAppSummary(players: Player[], history: MatchRecord[]): string {
  const playerMap = new Map(players.map((p) => [p.id, p.name]));

  const goalsMap = new Map<string, number>();
  const assistsMap = new Map<string, number>();

  history.forEach((match) => {
    match.events.forEach((ev) => {
      if (ev.scorerId !== 'own_goal') {
        goalsMap.set(ev.scorerId, (goalsMap.get(ev.scorerId) || 0) + 1);
      }
      if (ev.assistId) {
        assistsMap.set(ev.assistId, (assistsMap.get(ev.assistId) || 0) + 1);
      }
    });
  });

  const topScorers = [...goalsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topAssists = [...assistsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lines: string[] = [
    `⚽ *RESUMO DO RACHA* (${new Date().toLocaleDateString('pt-BR')})`,
    `━━━━━━━━━━━━━━━━━━`,
    `📊 *Partidas disputadas:* ${history.length}`,
    ``,
  ];

  if (history.length > 0) {
    lines.push(`🏟️ *PLACARES:*`);
    history.forEach((m, idx) => {
      lines.push(`${idx + 1}. ${m.teamAName} *${m.scoreA} x ${m.scoreB}* ${m.teamBName}`);
    });
    lines.push(``);
  }

  if (topScorers.length > 0) {
    lines.push(`🥅 *ARTILHARIA:*`);
    topScorers.forEach(([id, count], idx) => {
      lines.push(`${medalFor(idx)} ${playerMap.get(id) || 'Jogador'}: *${count}* gol(s)`);
    });
    lines.push(``);
  }

  if (topAssists.length > 0) {
    lines.push(`👟 *GARÇONS (ASSISTÊNCIAS):*`);
    topAssists.forEach(([id, count], idx) => {
      lines.push(`${medalFor(idx)} ${playerMap.get(id) || 'Jogador'}: *${count}* assist.`);
    });
    lines.push(``);
  }

  lines.push(`_Gerado via RachaPro_ ⚡`);
  return lines.join('\n');
}

/** Resumo do ranking geral histórico para colar no grupo. */
export function buildAllTimeSummary(
  rows: RankingRow[],
  archivedDays: number,
  archivedMatches: number
): string {
  const lines: string[] = [
    `🏆 *RANKING GERAL DO RACHA*`,
    `━━━━━━━━━━━━━━━━━━`,
    `📅 *Rachas arquivados:* ${archivedDays} • *Partidas:* ${archivedMatches}`,
    ``,
  ];

  if (rows.length === 0) {
    lines.push(`Ainda sem dados arquivados.`, ``);
  } else {
    lines.push(`⭐ *G+A (GOLS + ASSISTÊNCIAS):*`);
    rows.slice(0, 10).forEach((r, idx) => {
      lines.push(
        `${medalFor(idx)} ${r.name}: *${r.total}* (${r.goals}G • ${r.assists}A • ${r.wins}V)`
      );
    });
    lines.push(``);
  }

  lines.push(`_Gerado via RachaPro_ ⚡`);
  return lines.join('\n');
}

/** Escalação dos times para mandar no grupo antes da bola rolar. */
export function buildLineupText(teams: Team[], players: Player[]): string {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const lines: string[] = [
    `⚽ *ESCALAÇÃO DO RACHA* (${new Date().toLocaleDateString('pt-BR')})`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
  ];

  teams.forEach((team, idx) => {
    const tag = idx === 0 || idx === 1 ? ' — _em campo_' : ` — _próximo #${idx - 1}_`;
    lines.push(`${colorToEmoji(team.color)} *${team.name}*${tag}`);
    team.playerIds.forEach((id, i) => {
      const p = playerMap.get(id);
      if (!p) return;
      lines.push(`${i + 1}. ${p.name}${p.isGoalkeeper ? ' 🧤' : ''}`);
    });
    lines.push(``);
  });

  lines.push(`_Gerado via RachaPro_ ⚡`);
  return lines.join('\n');
}
