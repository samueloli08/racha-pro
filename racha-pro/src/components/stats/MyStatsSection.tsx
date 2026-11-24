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
      <div className="rp-card space-y-3 rounded-[24px] p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#84CC16]/12 text-[#BEF264]">
          <Link2 className="h-5 w-5" />
        </div>
        <div>
          <p className="rp-eyebrow">VÍNCULO PENDENTE</p>
          <h3 className="mt-1 text-base font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
            Sua conta ainda não está ligada a um jogador
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-[#879287]">
            {isAdmin
              ? 'Vincule sua conta ao seu nome no elenco para acompanhar suas estatísticas individuais aqui.'
              : 'Peça ao organizador para vincular sua conta ao seu jogador na aba Elenco → Vínculos.'}
          </p>
        </div>
        {isAdmin && onOpenLinkModal && (
          <button
            type="button"
            onClick={onOpenLinkModal}
            className="rp-btn-primary inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 text-xs"
          >
            <Link2 className="h-4 w-4" />
            Vincular meu jogador agora
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Cabeçalho do Jogador */}
      <div className="rp-card rounded-[24px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="rp-eyebrow">MINHAS ESTATÍSTICAS</p>
            <h3 className="mt-1 truncate text-2xl font-extrabold tracking-[-0.05em] text-[#F7FAEF]">
              {stats.playerName}
            </h3>
          </div>
          <span className="shrink-0 rounded-xl border border-[#BEF264]/30 bg-[#84CC16]/12 px-2.5 py-1 font-mono text-xs font-extrabold text-[#BEF264] tabular-nums">
            {stats.goals + stats.assists} G+A
          </span>
        </div>

        {/* KPIs principais */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rp-well rounded-2xl p-3">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#879287]">
              Partidas
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#F4F7F2] tabular-nums">
              {stats.matches}
            </p>
          </div>

          <div className="rp-well rounded-2xl p-3">
            <p className="flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#879287]">
              <CalendarCheck className="h-3 w-3 text-[#BEF264]" />
              Presenças
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#F4F7F2] tabular-nums">
              {stats.presences}
            </p>
          </div>

          <div className="rp-well rounded-2xl border-[#BEF264]/25 p-3">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#A3E635]">
              Gols
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#BEF264] tabular-nums">
              {stats.goals}
            </p>
          </div>

          <div className="rp-well rounded-2xl p-3">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#879287]">
              Assistências
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#F4F7F2] tabular-nums">
              {stats.assists}
            </p>
          </div>
        </div>
      </div>

      {/* Retrospecto: Vitórias / Empates / Derrotas */}
      <div className="rp-card space-y-3.5 rounded-[24px] p-4">
        <p className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#879287]">
          <Award className="h-3.5 w-3.5 text-[#FBBF24]" />
          Retrospecto em campo
        </p>

        <div className="grid grid-cols-3 gap-2">
          <div className="rp-well rounded-2xl p-3 text-center">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#879287]">
              Vitórias
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#34D399] tabular-nums">
              {stats.wins}
            </p>
          </div>

          <div className="rp-well rounded-2xl p-3 text-center">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#879287]">
              Empates
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#FBBF24] tabular-nums">
              {stats.draws}
            </p>
          </div>

          <div className="rp-well rounded-2xl p-3 text-center">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#879287]">
              Derrotas
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#F87171] tabular-nums">
              {stats.losses}
            </p>
          </div>
        </div>

        {/* Aproveitamento + Média de gols */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rp-well space-y-2 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#879287]">
                <TrendingUp className="h-3.5 w-3.5 text-[#BEF264]" />
                Aproveitamento
              </span>
              <span className="font-mono text-sm font-extrabold text-[#BEF264] tabular-nums">
                {stats.efficiencyPct !== null ? `${stats.efficiencyPct}%` : '—'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#19211B]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#84CC16] to-[#D9F99D] transition-all"
                style={{ width: `${Math.min(100, Math.max(0, stats.efficiencyPct ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="rp-well flex flex-col justify-between rounded-2xl p-3.5">
            <span className="flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#879287]">
              <Target className="h-3.5 w-3.5 text-[#FBBF24]" />
              Média de gols
            </span>
            <p className="mt-1 font-mono text-xl font-extrabold text-[#F4F7F2] tabular-nums">
              {stats.goalsPerMatch.toFixed(2)}
              <span className="ml-1 text-[11px] font-bold text-[#879287]">/ jogo</span>
            </p>
          </div>
        </div>

        {stats.legacyUnclassifiedMatches > 0 && (
          <p className="text-[11px] leading-relaxed text-[#879287]">
            Nota: {stats.legacyUnclassifiedMatches} partida(s) arquivada(s) antes desta atualização
            não possuíam separação entre empate e derrota e não entram no cálculo de aproveitamento.
          </p>
        )}
      </div>

      {/* Resumo como Goleiro (quando aplicável) */}
      {stats.gkMatches > 0 && (
        <div className="rp-surface flex items-center justify-between gap-3 rounded-[22px] p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBBF24]/12 text-[#FBBF24]">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                No gol
              </p>
              <p className="text-xs font-bold text-[#F4F7F2]">
                {stats.cleanSheets} jogo(s) sem sofrer gol
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-[#879287] tabular-nums">
            {stats.goalsConceded} sofr. · {stats.gkMatches}j
          </span>
        </div>
      )}
    </div>
  );
};
