import React, { useMemo, useState } from 'react';
import {
  Archive,
  CalendarCheck,
  Check,
  Copy,
  History,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  Trophy,
} from 'lucide-react';
import { AllTimePlayerStats, MatchRecord, Player, RankingTab } from '../../types/racha';
import { copyText } from '../../utils/clipboard';
import { ShareCardData } from '../../utils/shareCard';
import {
  buildGoalkeeperRanking,
  buildRanking,
  computeStatsFromHistory,
  metricOf,
  StatsMap,
  totalGoalsOf,
  withCurrentNames,
} from '../../utils/stats';
import { buildAllTimeSummary, buildWhatsAppSummary } from '../../utils/whatsappFormatter';
import { useToast } from '../ui/Toast';
import { ShareCardModal } from './ShareCardModal';

type Scope = 'today' | 'all';

interface StatsTabProps {
  players: Player[];
  history: MatchRecord[];
  allTimeStats: Record<string, AllTimePlayerStats>;
  archivedDays: number;
  archivedMatches: number;
  onArchiveDay: () => void;
  onResetDay: () => void;
  onResetAllTime: () => void;
}

const RANKING_TABS: { id: RankingTab; label: string; title: string }[] = [
  { id: 'general', label: 'Geral', title: 'Geral (G+A)' },
  { id: 'goals', label: 'Gols', title: 'Artilharia (Gols)' },
  { id: 'assists', label: 'Assist.', title: 'Garçons (Assistências)' },
  { id: 'wins', label: 'Vitórias', title: 'Vitórias' },
];

export const StatsTab: React.FC<StatsTabProps> = ({
  players,
  history,
  allTimeStats,
  archivedDays,
  archivedMatches,
  onArchiveDay,
  onResetDay,
  onResetAllTime,
}) => {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>('today');
  const [tab, setTab] = useState<RankingTab>('general');
  const [copied, setCopied] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const stats: StatsMap = useMemo(
    () =>
      scope === 'today'
        ? computeStatsFromHistory(history, players)
        : withCurrentNames(allTimeStats, players),
    [scope, history, players, allTimeStats]
  );

  const ranking = useMemo(() => buildRanking(stats, tab), [stats, tab]);
  const generalRanking = useMemo(() => buildRanking(stats, 'general'), [stats]);
  const goalkeepers = useMemo(() => buildGoalkeeperRanking(stats), [stats]);

  const activeTitle = RANKING_TABS.find((t) => t.id === tab)?.title ?? '';
  const isToday = scope === 'today';
  const matchesCount = isToday ? history.length : archivedMatches;
  const totalGoals = isToday
    ? totalGoalsOf(history)
    : Object.values(stats).reduce((acc, s) => acc + s.goals, 0);

  const cardData: ShareCardData = useMemo(() => {
    const rows = generalRanking.map((r) => ({
      name: r.name,
      goals: r.goals,
      assists: r.assists,
      total: r.total,
    }));
    const byGoals = buildRanking(stats, 'goals')[0];
    const byAssists = buildRanking(stats, 'assists')[0];
    return {
      heading: isToday ? 'Resumo do Racha de Hoje' : `Ranking Geral • ${archivedDays} rachas`,
      dateLabel: new Date().toLocaleDateString('pt-BR'),
      matches: matchesCount,
      totalGoals,
      podium: rows.slice(0, 3),
      topScorer: byGoals
        ? { name: byGoals.name, goals: byGoals.goals, assists: byGoals.assists, total: byGoals.total }
        : null,
      topAssist: byAssists
        ? {
            name: byAssists.name,
            goals: byAssists.goals,
            assists: byAssists.assists,
            total: byAssists.total,
          }
        : null,
    };
  }, [generalRanking, stats, isToday, archivedDays, matchesCount, totalGoals]);

  const handleCopyWhatsApp = async () => {
    const text = isToday
      ? buildWhatsAppSummary(players, history)
      : buildAllTimeSummary(generalRanking, archivedDays, archivedMatches);
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
    toast.show(ok ? 'Resumo copiado para o WhatsApp!' : 'Não foi possível copiar', ok ? 'success' : 'error');
  };

  const handleArchive = () => {
    const ok = window.confirm(
      `Encerrar o dia e arquivar ${history.length} partida(s) no ranking geral? Os placares de hoje serão zerados.`
    );
    if (!ok) return;
    onArchiveDay();
    toast.show('Racha arquivado no histórico geral!');
  };

  const handleResetDay = () => {
    if (!window.confirm('Descartar as estatísticas de hoje SEM somar ao histórico geral?')) return;
    onResetDay();
    toast.show('Estatísticas do dia zeradas', 'info');
  };

  const handleResetAll = () => {
    if (!window.confirm('Apagar TODO o ranking geral histórico? Isso não pode ser desfeito.')) return;
    onResetAllTime();
    toast.show('Histórico geral apagado', 'info');
  };

  const hasData = generalRanking.length > 0 || matchesCount > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900 p-1.5">
        {(
          [
            { id: 'today', label: 'Racha de Hoje', icon: <CalendarCheck className="h-4 w-4" /> },
            { id: 'all', label: 'Geral Histórico', icon: <History className="h-4 w-4" /> },
          ] as { id: Scope; label: string; icon: React.ReactNode }[]
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition ${
              scope === s.id ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {!isToday && (
        <p className="text-center text-xs text-zinc-500">
          {archivedDays} racha(s) arquivado(s) • {archivedMatches} partida(s)
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleCopyWhatsApp}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-2 text-xs font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 transition active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 stroke-[2.5]" /> Copiado!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copiar p/ WhatsApp
            </>
          )}
        </button>
        <button
          onClick={() => setShowCard(true)}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-2 text-xs font-extrabold text-emerald-400 transition active:scale-95"
        >
          <ImageIcon className="h-4 w-4" /> Gerar Card do MVP
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            {activeTitle} — {isToday ? 'Hoje' : 'Histórico'}
          </h2>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {RANKING_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-xl border text-[11px] font-bold transition ${
                tab === t.id
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {ranking.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            {isToday
              ? 'Nada registrado nas partidas finalizadas ainda.'
              : 'Nada arquivado ainda. Use "Encerrar Dia / Arquivar Racha" no fim da pelada.'}
          </p>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_2rem_2rem_2rem_2.5rem] items-center gap-x-1 border-b border-zinc-800 pb-2 text-[11px] uppercase text-zinc-500">
              <span />
              <span>Jogador</span>
              <span className="text-center">G</span>
              <span className="text-center">A</span>
              <span className="text-center">V</span>
              <span className="text-right">
                {tab === 'general' ? 'G+A' : tab === 'goals' ? 'Gols' : tab === 'assists' ? 'Ast' : 'Vit'}
              </span>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {ranking.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid min-h-[44px] grid-cols-[1.75rem_minmax(0,1fr)_2rem_2rem_2rem_2.5rem] items-center gap-x-1 text-sm"
                >
                  <span className="text-xs text-zinc-500">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className="truncate font-semibold text-white">{row.name}</span>
                  <span className="text-center font-mono text-zinc-300">{row.goals}</span>
                  <span className="text-center font-mono text-zinc-300">{row.assists}</span>
                  <span className="text-center font-mono text-zinc-300">{row.wins}</span>
                  <span className="text-right font-mono font-extrabold text-emerald-400">
                    {metricOf(row, tab)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {goalkeepers.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-300">
            🧤 Goleiros — Jogos sem sofrer gol
          </h2>
          <div className="divide-y divide-zinc-800/60">
            {goalkeepers.map((gk) => (
              <div
                key={gk.id}
                className="flex min-h-[44px] items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate font-semibold text-white">{gk.name}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  <span className="font-mono font-extrabold text-emerald-400">{gk.cleanSheets}</span>{' '}
                  CS • {gk.goalsConceded} sofr. • {gk.gkMatches} jogo(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isToday && (
        <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Histórico de Partidas ({history.length})
          </h3>
          {history.length === 0 ? (
            <p className="py-2 text-xs text-zinc-500">As partidas encerradas aparecerão aqui.</p>
          ) : (
            history.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 px-3.5 py-3 text-xs"
              >
                <span className="min-w-0 truncate font-bold text-white">
                  {m.teamAName} <span className="text-emerald-400">{m.scoreA}</span> x{' '}
                  <span className="text-emerald-400">{m.scoreB}</span> {m.teamBName}
                </span>
                <span className="shrink-0 text-zinc-500">{m.finishedAt}</span>
              </div>
            ))
          )}
        </div>
      )}

      {isToday ? (
        history.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={handleArchive}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-extrabold text-zinc-950 shadow-lg shadow-amber-500/10 transition active:scale-95"
            >
              <Archive className="h-4 w-4" /> Encerrar Dia / Arquivar Racha
            </button>
            <button
              onClick={handleResetDay}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-bold text-red-400"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Descartar Estatísticas do Dia
            </button>
          </div>
        )
      ) : (
        archivedMatches > 0 && (
          <button
            onClick={handleResetAll}
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-bold text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Apagar Ranking Geral
          </button>
        )
      )}

      {!hasData && isToday && (
        <p className="text-center text-xs text-zinc-600">
          Jogue e encerre partidas para ver os números aqui.
        </p>
      )}

      {showCard && <ShareCardModal data={cardData} onClose={() => setShowCard(false)} />}
    </div>
  );
};
