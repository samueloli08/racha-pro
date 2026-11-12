import React, { useState } from 'react';
import { Check, Copy, RotateCcw, Trophy } from 'lucide-react';
import { MatchRecord, Player } from '../../types/racha';
import { buildWhatsAppSummary } from '../../utils/whatsappFormatter';

interface StatsTabProps {
  players: Player[];
  history: MatchRecord[];
  onResetDay: () => void;
}

export const StatsTab: React.FC<StatsTabProps> = ({
  players,
  history,
  onResetDay,
}) => {
  const [copied, setCopied] = useState(false);

  const playerMap = new Map(players.map((p) => [p.id, p.name]));
  const stats = new Map<string, { goals: number; assists: number }>();

  history.forEach((m) => {
    m.events.forEach((ev) => {
      if (ev.scorerId !== 'own_goal') {
        const cur = stats.get(ev.scorerId) || { goals: 0, assists: 0 };
        stats.set(ev.scorerId, { ...cur, goals: cur.goals + 1 });
      }
      if (ev.assistId) {
        const cur = stats.get(ev.assistId) || { goals: 0, assists: 0 };
        stats.set(ev.assistId, { ...cur, assists: cur.assists + 1 });
      }
    });
  });

  const ranking = [...stats.entries()]
    .map(([id, s]) => ({
      id,
      name: playerMap.get(id) || 'Jogador',
      goals: s.goals,
      assists: s.assists,
      total: s.goals + s.assists,
    }))
    .sort((a, b) => b.total - a.total || b.goals - a.goals);

  const handleCopyWhatsApp = async () => {
    const text = buildWhatsAppSummary(players, history);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-5">
      <button
        onClick={handleCopyWhatsApp}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 transition active:scale-95"
      >
        {copied ? (
          <>
            <Check className="h-5 w-5 stroke-[2.5]" /> Resumo Copiado!
          </>
        ) : (
          <>
            <Copy className="h-5 w-5" /> Compartilhar Resumo no WhatsApp
          </>
        )}
      </button>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Ranking do Racha (Gols & Assistências)
          </h2>
        </div>

        {ranking.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            Nenhum gol registrado nas partidas finalizadas ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase text-zinc-500">
                  <th className="pb-2">Jogador</th>
                  <th className="pb-2 text-center">Gols</th>
                  <th className="pb-2 text-center">Assist</th>
                  <th className="pb-2 text-right">G+A</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {ranking.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="py-2.5 font-semibold text-white">
                      <span className="mr-2 text-xs text-zinc-500">
                        #{idx + 1}
                      </span>
                      {row.name}
                    </td>
                    <td className="py-2.5 text-center font-mono text-zinc-300">
                      {row.goals}
                    </td>
                    <td className="py-2.5 text-center font-mono text-zinc-300">
                      {row.assists}
                    </td>
                    <td className="py-2.5 text-right font-mono font-extrabold text-emerald-400">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Histórico de Partidas ({history.length})
        </h3>
        {history.length === 0 ? (
          <p className="py-2 text-xs text-zinc-500">
            As partidas encerradas aparecerão aqui.
          </p>
        ) : (
          history.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs"
            >
              <span className="font-bold text-white">
                {m.teamAName} <span className="text-emerald-400">{m.scoreA}</span> x{' '}
                <span className="text-emerald-400">{m.scoreB}</span> {m.teamBName}
              </span>
              <span className="text-zinc-500">{m.finishedAt}</span>
            </div>
          ))
        )}
      </div>

      {history.length > 0 && (
        <button
          onClick={onResetDay}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-xs font-bold text-red-400"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Zerar Estatísticas do Dia
        </button>
      )}
    </div>
  );
};
