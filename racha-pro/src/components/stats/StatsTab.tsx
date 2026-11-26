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
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-[#FDE68A] to-[#F59E0B] font-mono text-[11px] font-extrabold text-[#1A1405] shadow-sm">
        1
      </span>
    );
  }
  if (index === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-[#E2E8F0] to-[#94A3B8] font-mono text-[11px] font-extrabold text-[#0F172A]">
        2
      </span>
    );
  }
  if (index === 2) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-[#EA580C] to-[#9A3412] font-mono text-[11px] font-extrabold text-white shadow-sm">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center font-mono text-[11px] font-bold text-[#647468]">
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
        ? {
            name: byGoals.name,
            goals: byGoals.goals,
            assists: byGoals.assists,
            total: byGoals.total,
          }
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
    <div className="space-y-5">
      {/* Barra superior: Seletor de Visão + Ações de compartilhamento lado a lado no desktop */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          className={`rp-surface grid gap-1.5 rounded-[20px] p-1.5 md:w-[380px] ${
            showMineTab ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {scopeOptions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-[14px] px-3 text-xs font-extrabold transition ${
                scope === s.id
                  ? 'rp-btn-primary'
                  : 'text-[#647468] hover:bg-[#F6F9F2] hover:text-[#0D1510]'
              }`}
            >
              {s.icon}
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>

        {!isMine && (
          <div className="grid grid-cols-2 gap-2.5 md:flex md:items-center">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="rp-btn-primary flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] px-4 text-xs"
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
              className="rp-btn-secondary flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] px-4 text-xs"
            >
              <ImageIcon className="h-4 w-4 text-[#3F6212]" /> Card de Stories
            </button>
          </div>
        )}
      </div>

      {isMine ? (
        <MyStatsSection
          stats={personalStats}
          isAdmin={isAdmin}
          onOpenLinkModal={onOpenLinkModal}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Coluna Esquerda (7 cols): Ranking Completo */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rp-card rp-stagger rounded-[26px] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold tracking-[-0.03em] text-[#0D1510]">
                      {activeTitle} · {isToday ? 'Hoje' : 'Histórico'}
                    </h3>
                    {!isToday && (
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#647468]">
                        {archivedDays} racha(s) · {archivedMatches} partida(s)
                      </p>
                    )}
                  </div>
                </div>
                <span className="rounded-xl border border-[#84CC16]/40 bg-[#ECFCCB] px-2.5 py-1 font-mono text-xs font-extrabold text-[#365314] tabular-nums">
                  {totalGoals} gols
                </span>
              </div>

              <div className="mb-4 grid grid-cols-4 gap-1.5">
                {RANKING_TABS.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold transition ${
                        active
                          ? 'border-[#65A30D]/45 bg-[#ECFCCB] text-[#365314] shadow-sm'
                          : 'border-[#0D1510]/[0.08] bg-[#F6F9F2] text-[#647468] hover:text-[#0D1510]'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {ranking.length === 0 ? (
                <p className="rp-well rounded-2xl py-8 text-center text-xs font-medium text-[#647468]">
                  {isToday
                    ? 'Nada registrado nas partidas encerradas ainda.'
                    : 'Nada arquivado ainda. Use "Encerrar dia e arquivar" ao final da pelada.'}
                </p>
              ) : (
                <div className="w-full">
                  <div className="grid grid-cols-[1.85rem_minmax(0,1fr)_1.75rem_1.75rem_1.75rem_2.5rem] items-center gap-x-1 border-b border-[#0D1510]/10 pb-2.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#647468] sm:grid-cols-[2.25rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem_3.25rem]">
                    <span />
                    <span>Jogador</span>
                    <span className="text-center">G</span>
                    <span className="text-center">A</span>
                    <span className="text-center">V</span>
                    <span className="text-right text-[#3F6212]">
                      {tab === 'general'
                        ? 'G+A'
                        : tab === 'goals'
                        ? 'Gols'
                        : tab === 'assists'
                        ? 'Ast'
                        : 'Vit'}
                    </span>
                  </div>
                  <div className="divide-y divide-[#0D1510]/[0.06]">
                    {ranking.map((row, idx) => (
                      <div
                        key={row.id}
                        className="grid min-h-[50px] grid-cols-[1.85rem_minmax(0,1fr)_1.75rem_1.75rem_1.75rem_2.5rem] items-center gap-x-1 rounded-xl px-1 text-sm transition hover:bg-[#F6F9F2] sm:grid-cols-[2.25rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem_3.25rem]"
                      >
                        <RankBadge index={idx} />
                        <span className="truncate font-extrabold text-[#0D1510]">{row.name}</span>
                        <span className="text-center font-mono text-xs font-semibold text-[#46544A] tabular-nums">
                          {row.goals}
                        </span>
                        <span className="text-center font-mono text-xs font-semibold text-[#46544A] tabular-nums">
                          {row.assists}
                        </span>
                        <span className="text-center font-mono text-xs font-semibold text-[#46544A] tabular-nums">
                          {row.wins}
                        </span>
                        <span className="text-right font-mono text-sm font-extrabold text-[#3F6212] tabular-nums">
                          {metricOf(row, tab)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!hasData && isToday && (
              <p className="text-center text-xs font-medium text-[#647468]">
                Jogue e encerre partidas para ver os números aqui.
              </p>
            )}
          </div>

          {/* Coluna Direita (5 cols): Goleiros + Partidas de hoje + Arquivamento */}
          <div className="space-y-4 lg:sticky lg:top-8 lg:col-span-5">
            {goalkeepers.length > 0 && (
              <div
                className="rp-card rp-stagger rounded-[26px] p-5"
                style={{ '--stagger': 1 } as React.CSSProperties}
              >
                <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#3F6212]">
                  <Shield className="h-4 w-4 text-[#D97706]" />
                  Goleiros · Jogos sem sofrer gol
                </h3>
                <div className="divide-y divide-[#0D1510]/[0.06]">
                  {goalkeepers.map((gk) => (
                    <div
                      key={gk.id}
                      className="flex min-h-[46px] items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-bold text-[#0D1510]">{gk.name}</span>
                      <span className="shrink-0 font-mono text-xs text-[#647468] tabular-nums">
                        <span className="font-extrabold text-[#3F6212]">{gk.cleanSheets}</span> CS ·{' '}
                        {gk.goalsConceded} sofr. · {gk.gkMatches}j
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isToday && (
              <div
                className="rp-card rp-stagger space-y-3 rounded-[26px] p-5"
                style={{ '--stagger': 2 } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#647468]">
                    Partidas de hoje
                  </h3>
                  <span className="rounded-lg bg-[#F6F9F2] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#3F6212] tabular-nums">
                    {history.length}
                  </span>
                </div>
                {history.length === 0 ? (
                  <p className="rp-well rounded-2xl py-6 text-center text-xs font-medium text-[#647468]">
                    As partidas encerradas aparecerão aqui.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.map((m) => (
                      <div
                        key={m.id}
                        className="rp-well flex items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-xs"
                      >
                        <span className="min-w-0 truncate font-bold text-[#0D1510]">
                          {m.teamAName}{' '}
                          <span className="font-mono text-sm font-extrabold text-[#3F6212]">
                            {m.scoreA}
                          </span>{' '}
                          <span className="font-mono text-[#A8B8A4]">×</span>{' '}
                          <span className="font-mono text-sm font-extrabold text-[#3F6212]">
                            {m.scoreB}
                          </span>{' '}
                          {m.teamBName}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-[#647468] tabular-nums">
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
                  <div className="rp-card space-y-2.5 rounded-[26px] p-5">
                    <p className="rp-eyebrow">FECHAMENTO DO DIA</p>
                    <button
                      type="button"
                      onClick={handleArchive}
                      className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-br from-[#FDE68A] to-[#F59E0B] text-sm font-extrabold text-[#1A1405] shadow-md shadow-[#F59E0B]/20 hover:brightness-105"
                    >
                      <Archive className="h-4 w-4" /> Encerrar dia e arquivar racha
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDay}
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#DC2626]/25 bg-[#FEE2E2] text-xs font-bold text-[#991B1B] hover:bg-[#FECACA]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Descartar estatísticas do dia
                    </button>
                  </div>
                )
              ) : (
                archivedMatches > 0 && (
                  <div className="rp-card space-y-2.5 rounded-[26px] p-5">
                    <p className="rp-eyebrow">MANUTENÇÃO</p>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#DC2626]/25 bg-[#FEE2E2] text-xs font-bold text-[#991B1B] hover:bg-[#FECACA]"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Apagar ranking geral
                    </button>
                  </div>
                )
              ))}
          </div>
        </div>
      )}

      {showCard && <ShareCardModal data={cardData} onClose={() => setShowCard(false)} />}
    </div>
  );
};
