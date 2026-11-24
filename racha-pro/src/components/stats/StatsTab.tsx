import React, { useMemo, useState } from 'react';
import {
  Archive,
  CalendarCheck,
  Check,
  Copy,
  History,
  Image as ImageIcon,
  RotateCcw,
  Shield,
  Trash2,
  Trophy,
  User,
} from 'lucide-react';
import { AllTimePlayerStats, MatchRecord, Player, RachaRole, RankingTab } from '../../types/racha';
import { copyText } from '../../utils/clipboard';
import { ShareCardData } from '../../utils/shareCard';
import {
  buildGoalkeeperRanking,
  buildRanking,
  computePersonalStats,
  computeStatsFromHistory,
  metricOf,
  StatsMap,
  totalGoalsOf,
  withCurrentNames,
} from '../../utils/stats';
import { buildAllTimeSummary, buildWhatsAppSummary } from '../../utils/whatsappFormatter';
import { useToast } from '../ui/Toast';
import { MyStatsSection } from './MyStatsSection';
import { ShareCardModal } from './ShareCardModal';

type Scope = 'today' | 'all' | 'mine';

interface StatsTabProps {
  rachaName?: string;
  players: Player[];
  history: MatchRecord[];
  allTimeStats: Record<string, AllTimePlayerStats>;
  archivedDays: number;
  archivedMatches: number;
  role?: RachaRole;
  readOnly?: boolean;
  myPlayerId?: string | null;
  myConfirmedPresences?: number;
  onArchiveDay: () => void;
  onResetDay: () => void;
  onResetAllTime: () => void;
  onOpenLinkModal?: () => void;
}

const RANKING_TABS: { id: RankingTab; label: string; title: string }[] = [
  { id: 'general', label: 'Geral', title: 'Geral (G+A)' },
  { id: 'goals', label: 'Gols', title: 'Artilharia' },
  { id: 'assists', label: 'Assist.', title: 'Garçons' },
  { id: 'wins', label: 'Vitórias', title: 'Vitórias' },
];

function formatLongPtDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function RankBadge({ index }: { index: number }) {
  if (index === 0) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-b from-[#FDE68A] to-[#FBBF24] font-mono text-[11px] font-extrabold text-[#1A1405]">
        1
      </span>
    );
  }
  if (index === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-b from-[#E4E4E7] to-[#A1A1AA] font-mono text-[11px] font-extrabold text-[#0B100D]">
        2
      </span>
    );
  }
  if (index === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-b from-[#F59E0B] to-[#B45309] font-mono text-[11px] font-extrabold text-[#1A0F02]">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center font-mono text-[11px] font-bold text-[#879287]">
      {index + 1}
    </span>
  );
}

export const StatsTab: React.FC<StatsTabProps> = ({
  rachaName,
  players,
  history,
  allTimeStats,
  archivedDays,
  archivedMatches,
  role,
  readOnly = false,
  myPlayerId = null,
  myConfirmedPresences = 0,
  onArchiveDay,
  onResetDay,
  onResetAllTime,
  onOpenLinkModal,
}) => {
  const effectiveRole: RachaRole = role ?? (readOnly ? 'viewer' : 'admin');
  const isAdmin = effectiveRole === 'admin';
  const showMineTab = effectiveRole !== 'viewer';

  const toast = useToast();
  const [scope, setScope] = useState<Scope>(effectiveRole === 'member' ? 'mine' : 'today');
  const [tab, setTab] = useState<RankingTab>('general');
  const [copied, setCopied] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const personalStats = useMemo(
    () =>
      myPlayerId
        ? computePersonalStats(myPlayerId, players, history, allTimeStats, myConfirmedPresences)
        : null,
    [myPlayerId, players, history, allTimeStats, myConfirmedPresences]
  );

  const stats: StatsMap = useMemo(
    () =>
      scope === 'all'
        ? withCurrentNames(allTimeStats, players)
        : computeStatsFromHistory(history, players),
    [scope, history, players, allTimeStats]
  );

  const ranking = useMemo(() => buildRanking(stats, tab), [stats, tab]);
  const generalRanking = useMemo(() => buildRanking(stats, 'general'), [stats]);
  const goalkeepers = useMemo(() => buildGoalkeeperRanking(stats), [stats]);

  const activeTitle = RANKING_TABS.find((t) => t.id === tab)?.title ?? '';
  const isToday = scope === 'today';
  const isMine = scope === 'mine';
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
    const baseName = rachaName?.trim() || 'Racha de Hoje';
    return {
      heading: isToday ? baseName : `${baseName} · ${archivedDays} rachas`,
      dateLabel: formatLongPtDate(new Date()),
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
  }, [generalRanking, stats, rachaName, isToday, archivedDays, matchesCount, totalGoals]);

  const handleCopyWhatsApp = async () => {
    const text = isToday
      ? buildWhatsAppSummary(players, history)
      : buildAllTimeSummary(generalRanking, archivedDays, archivedMatches);
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
    toast.show(
      ok ? 'Resumo copiado para o WhatsApp!' : 'Não foi possível copiar',
      ok ? 'success' : 'error'
    );
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
    if (!window.confirm('Apagar TODO o ranking geral histórico? Isso não pode ser desfeito.'))
      return;
    onResetAllTime();
    toast.show('Histórico geral apagado', 'info');
  };

  const hasData = generalRanking.length > 0 || matchesCount > 0;

  const scopeOptions: { id: Scope; label: string; icon: React.ReactNode }[] = [
    ...(showMineTab
      ? [{ id: 'mine' as Scope, label: 'Minhas', icon: <User className="h-3.5 w-3.5" /> }]
      : []),
    { id: 'today', label: 'Hoje', icon: <CalendarCheck className="h-3.5 w-3.5" /> },
    { id: 'all', label: 'Histórico', icon: <History className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Seletor de Visão */}
      <div
        className={`rp-surface grid gap-1.5 rounded-[20px] p-1.5 ${
          showMineTab ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        {scopeOptions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] px-2 text-xs font-extrabold transition ${
              scope === s.id ? 'rp-btn-primary' : 'text-[#879287] hover:text-[#F4F7F2]'
            }`}
          >
            {s.icon}
            <span className="truncate">{s.label}</span>
          </button>
        ))}
      </div>

      {isMine ? (
        <MyStatsSection
          stats={personalStats}
          isAdmin={isAdmin}
          onOpenLinkModal={onOpenLinkModal}
        />
      ) : (
        <>
          {!isToday && (
            <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#879287]">
              {archivedDays} racha(s) arquivado(s) · {archivedMatches} partida(s)
            </p>
          )}

          {/* Ações de Compartilhamento */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="rp-btn-primary flex min-h-[50px] items-center justify-center gap-2 rounded-[18px] px-3 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar pro grupo
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowCard(true)}
              className="flex min-h-[50px] items-center justify-center gap-2 rounded-[18px] border border-[#BEF264]/35 bg-[#84CC16]/10 px-3 text-xs font-extrabold text-[#D9F99D] transition hover:bg-[#84CC16]/18"
            >
              <ImageIcon className="h-4 w-4" /> Card de Stories
            </button>
          </div>

          {/* Ranking Principal */}
          <div className="rp-card rounded-[24px] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#FBBF24]" />
                <h3 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#C9D3C4]">
                  {activeTitle} · {isToday ? 'Hoje' : 'Histórico'}
                </h3>
              </div>
              <span className="font-mono text-[11px] font-bold text-[#879287] tabular-nums">
                {totalGoals} gols
              </span>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {RANKING_TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`min-h-[40px] rounded-xl border text-[11px] font-bold transition ${
                      active
                        ? 'border-[#BEF264]/45 bg-[#84CC16]/15 text-[#D9F99D]'
                        : 'border-white/[0.085] bg-[#0B100D] text-[#879287] hover:text-[#C9D3C4]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {ranking.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#879287]">
                {isToday
                  ? 'Nada registrado nas partidas encerradas ainda.'
                  : 'Nada arquivado ainda. Use "Encerrar dia e arquivar" ao final da pelada.'}
              </p>
            ) : (
              <div className="w-full">
                <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem_2rem_2rem_2.75rem] items-center gap-x-1 border-b border-white/[0.085] pb-2 font-mono text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#879287]">
                  <span />
                  <span>Jogador</span>
                  <span className="text-center">G</span>
                  <span className="text-center">A</span>
                  <span className="text-center">V</span>
                  <span className="text-right text-[#BEF264]">
                    {tab === 'general'
                      ? 'G+A'
                      : tab === 'goals'
                      ? 'Gols'
                      : tab === 'assists'
                      ? 'Ast'
                      : 'Vit'}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {ranking.map((row, idx) => (
                    <div
                      key={row.id}
                      className="grid min-h-[46px] grid-cols-[2rem_minmax(0,1fr)_2rem_2rem_2rem_2.75rem] items-center gap-x-1 text-sm"
                    >
                      <RankBadge index={idx} />
                      <span className="truncate font-bold text-[#F4F7F2]">{row.name}</span>
                      <span className="text-center font-mono text-xs text-[#C9D3C4] tabular-nums">
                        {row.goals}
                      </span>
                      <span className="text-center font-mono text-xs text-[#C9D3C4] tabular-nums">
                        {row.assists}
                      </span>
                      <span className="text-center font-mono text-xs text-[#C9D3C4] tabular-nums">
                        {row.wins}
                      </span>
                      <span className="text-right font-mono text-sm font-extrabold text-[#BEF264] tabular-nums">
                        {metricOf(row, tab)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Goleiros */}
          {goalkeepers.length > 0 && (
            <div className="rp-card rounded-[24px] p-4">
              <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#C9D3C4]">
                <Shield className="h-4 w-4 text-[#FBBF24]" />
                Goleiros · Jogos sem sofrer gol
              </h3>
              <div className="divide-y divide-white/[0.05]">
                {goalkeepers.map((gk) => (
                  <div
                    key={gk.id}
                    className="flex min-h-[44px] items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-bold text-[#F4F7F2]">{gk.name}</span>
                    <span className="shrink-0 font-mono text-xs text-[#879287] tabular-nums">
                      <span className="font-extrabold text-[#BEF264]">{gk.cleanSheets}</span> CS ·{' '}
                      {gk.goalsConceded} sofr. · {gk.gkMatches}j
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Partidas */}
          {isToday && (
            <div className="rp-surface space-y-2.5 rounded-[24px] p-4">
              <h3 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#879287]">
                Partidas de hoje ({history.length})
              </h3>
              {history.length === 0 ? (
                <p className="py-2 text-xs text-[#879287]">
                  As partidas encerradas aparecerão aqui.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((m) => (
                    <div
                      key={m.id}
                      className="rp-well flex items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-xs"
                    >
                      <span className="min-w-0 truncate font-bold text-[#F4F7F2]">
                        {m.teamAName}{' '}
                        <span className="font-mono font-extrabold text-[#BEF264]">
                          {m.scoreA}
                        </span>{' '}
                        <span className="font-mono text-[#4B554C]">×</span>{' '}
                        <span className="font-mono font-extrabold text-[#BEF264]">
                          {m.scoreB}
                        </span>{' '}
                        {m.teamBName}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[#879287] tabular-nums">
                        {m.finishedAt}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ações de Arquivamento / Reset (exclusivo Admin) */}
          {isAdmin &&
            (isToday ? (
              history.length > 0 && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleArchive}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-br from-[#FDE68A] to-[#FBBF24] text-sm font-extrabold text-[#1A1405] shadow-lg shadow-[#FBBF24]/15"
                  >
                    <Archive className="h-4 w-4" /> Encerrar dia e arquivar racha
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDay}
                    className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#F87171]/30 bg-[#F87171]/10 text-xs font-bold text-[#FCA5A5] hover:bg-[#F87171]/15"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Descartar estatísticas do dia
                  </button>
                </div>
              )
            ) : (
              archivedMatches > 0 && (
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#F87171]/30 bg-[#F87171]/10 text-xs font-bold text-[#FCA5A5] hover:bg-[#F87171]/15"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Apagar ranking geral
                </button>
              )
            ))}

          {!hasData && isToday && (
            <p className="text-center text-xs text-[#879287]">
              Jogue e encerre partidas para ver os números aqui.
            </p>
          )}
        </>
      )}

      {showCard && <ShareCardModal data={cardData} onClose={() => setShowCard(false)} />}
    </div>
  );
};
