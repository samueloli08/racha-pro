import React from 'react';
import { Award, CalendarCheck, Link2, Shield, Target, TrendingUp } from 'lucide-react';
import { PlayerPersonalStats } from '../../types/racha';

interface MyStatsSectionProps {
  stats: PlayerPersonalStats | null;
  isAdmin: boolean;
  onOpenLinkModal?: () => void;
}

export const MyStatsSection: React.FC<MyStatsSectionProps> = ({
  stats,
  isAdmin,
  onOpenLinkModal,
}) => {
  if (!stats) {
    return (
      <div className="rp-card mx-auto max-w-xl space-y-3 rounded-[28px] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFCCB] text-[#3F6212]">
          <Link2 className="h-5 w-5" />
        </div>
        <div>
          <p className="rp-eyebrow">VÍNCULO PENDENTE</p>
          <h3 className="mt-1 text-lg font-extrabold tracking-[-0.03em] text-[#0D1510]">
            Sua conta ainda não está ligada a um jogador
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-[#647468]">
            {isAdmin
              ? 'Vincule sua conta ao seu nome no elenco para acompanhar suas estatísticas individuais aqui.'
              : 'Peça ao organizador para vincular sua conta ao seu jogador na aba Elenco → Vínculos.'}
          </p>
        </div>
        {isAdmin && onOpenLinkModal && (
          <button
            type="button"
            onClick={onOpenLinkModal}
            className="rp-btn-primary inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-5 text-xs"
          >
            <Link2 className="h-4 w-4" />
            Vincular meu jogador agora
          </button>
        )}
      </div>
    );
  }

  const classified = stats.wins + stats.draws + stats.losses;
  const winPct = classified > 0 ? (stats.wins / classified) * 100 : 0;
  const drawPct = classified > 0 ? (stats.draws / classified) * 100 : 0;
  const lossPct = classified > 0 ? (stats.losses / classified) * 100 : 0;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      {/* Cabeçalho do Jogador + KPIs Principais (7 cols) */}
      <div className="rp-card rp-stagger rounded-[28px] p-6 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="rp-eyebrow">MINHAS ESTATÍSTICAS</p>
            <h3 className="mt-1 truncate text-3xl font-extrabold tracking-[-0.05em] text-[#0D1510]">
              {stats.playerName}
            </h3>
          </div>
          <span className="shrink-0 rounded-2xl border border-[#65A30D]/40 bg-[#ECFCCB] px-3.5 py-1.5 font-mono text-sm font-extrabold text-[#365314] tabular-nums">
            {stats.goals + stats.assists} G+A
          </span>
        </div>

        {/* KPIs principais */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            className="rp-well rp-stagger rounded-2xl p-4"
            style={{ '--stagger': 1 } as React.CSSProperties}
          >
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#647468]">
              Partidas
            </p>
            <p className="mt-1.5 font-mono text-3xl font-extrabold text-[#0D1510] tabular-nums">
              {stats.matches}
            </p>
          </div>

          <div
            className="rp-well rp-stagger rounded-2xl p-4"
            style={{ '--stagger': 2 } as React.CSSProperties}
          >
            <p className="flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#647468]">
              <CalendarCheck className="h-3 w-3 text-[#3F6212]" />
              Presenças
            </p>
            <p className="mt-1.5 font-mono text-3xl font-extrabold text-[#0D1510] tabular-nums">
              {stats.presences}
            </p>
          </div>

          <div
            className="rp-stagger rounded-2xl border border-[#84CC16]/45 bg-[#ECFCCB]/65 p-4"
            style={{ '--stagger': 3 } as React.CSSProperties}
          >
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#3F6212]">
              Gols
            </p>
            <p className="mt-1.5 font-mono text-3xl font-extrabold text-[#365314] tabular-nums">
              {stats.goals}
            </p>
          </div>

          <div
            className="rp-well rp-stagger rounded-2xl p-4"
            style={{ '--stagger': 4 } as React.CSSProperties}
          >
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#647468]">
              Assistências
            </p>
            <p className="mt-1.5 font-mono text-3xl font-extrabold text-[#0D1510] tabular-nums">
              {stats.assists}
            </p>
          </div>
        </div>

        {/* Aproveitamento + Média de gols */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rp-well space-y-2.5 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#647468]">
                <TrendingUp className="h-3.5 w-3.5 text-[#3F6212]" />
                Aproveitamento
              </span>
              <span className="font-mono text-base font-extrabold text-[#365314] tabular-nums">
                {stats.efficiencyPct !== null ? `${stats.efficiencyPct}%` : '—'}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#E2EBDC]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#84CC16] to-[#4D7C0F] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, stats.efficiencyPct ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="rp-well flex flex-col justify-between rounded-2xl p-4">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#647468]">
              <Target className="h-3.5 w-3.5 text-[#D97706]" />
              Média de gols
            </span>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#0D1510] tabular-nums">
              {stats.goalsPerMatch.toFixed(2)}
              <span className="ml-1.5 text-xs font-bold text-[#647468]">/ jogo</span>
            </p>
          </div>
        </div>
      </div>

      {/* Coluna Direita: Retrospecto + Goleiro (5 cols) */}
      <div className="space-y-4 lg:col-span-5">
        <div
          className="rp-card rp-stagger space-y-4 rounded-[28px] p-6"
          style={{ '--stagger': 2 } as React.CSSProperties}
        >
          <p className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#3F6212]">
            <Award className="h-4 w-4 text-[#D97706]" />
            Retrospecto em campo
          </p>

          {classified > 0 && (
            <div className="flex h-3 overflow-hidden rounded-full bg-[#E2EBDC]">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${winPct}%` }}
              />
              <div
                className="bg-amber-400 transition-all duration-500"
                style={{ width: `${drawPct}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-500"
                style={{ width: `${lossPct}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/70 p-3.5 text-center">
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">
                Vitórias
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
                {stats.wins}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/25 bg-amber-50/80 p-3.5 text-center">
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-800">
                Empates
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-amber-700 tabular-nums">
                {stats.draws}
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-50/75 p-3.5 text-center">
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-red-700">
                Derrotas
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-red-600 tabular-nums">
                {stats.losses}
              </p>
            </div>
          </div>

          {stats.legacyUnclassifiedMatches > 0 && (
            <p className="text-[11px] leading-relaxed text-[#647468]">
              Nota: {stats.legacyUnclassifiedMatches} partida(s) arquivada(s) antes desta atualização
              não possuíam separação entre empate e derrota e não entram no cálculo de
              aproveitamento.
            </p>
          )}
        </div>

        {/* Resumo como Goleiro (quando aplicável) */}
        {stats.gkMatches > 0 && (
          <div
            className="rp-card rp-stagger flex items-center justify-between gap-3 rounded-[24px] p-5"
            style={{ '--stagger': 3 } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                  No gol
                </p>
                <p className="text-sm font-extrabold text-[#0D1510]">
                  {stats.cleanSheets} jogo(s) sem sofrer gol
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-[#647468] tabular-nums">
              {stats.goalsConceded} sofr. · {stats.gkMatches}j
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
