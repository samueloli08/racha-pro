import { MatchRecord, Player } from '../types/racha';

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

  const topScorers = [...goalsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topAssists = [...assistsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
      lines.push(`${medal} ${playerMap.get(id) || 'Jogador'}: *${count}* gol(s)`);
    });
    lines.push(``);
  }

  if (topAssists.length > 0) {
    lines.push(`👟 *GARÇONS (ASSISTÊNCIAS):*`);
    topAssists.forEach(([id, count], idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
      lines.push(`${medal} ${playerMap.get(id) || 'Jogador'}: *${count}* assist.`);
    });
    lines.push(``);
  }

  lines.push(`_Gerado via RachaPro_ ⚡`);
  return lines.join('\n');
}
