import React from 'react';
import { AlertTriangle, CheckCircle2, Flag, RefreshCw, Trophy, X } from 'lucide-react';
import { RotationRule, Team } from '../../types/racha';

interface EndMatchModalProps {
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  teamsCount: number;
  onConfirm: (rule: RotationRule) => void;
  onClose: () => void;
}

export const EndMatchModal: React.FC<EndMatchModalProps> = ({
  teamA,
  teamB,
  scoreA,
  scoreB,
  teamsCount,
  onConfirm,
  onClose,
}) => {
  const isDraw = scoreA === scoreB;
  const winner = scoreA > scoreB ? teamA : teamB;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rp-card max-h-[92vh] w-full max-w-md animate-sheet-in space-y-4 overflow-y-auto rounded-[28px] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
            <Flag className="h-4 w-4 text-[#BEF264]" /> Encerrar partida
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.085] bg-[#0B100D] text-[#879287] hover:text-[#F4F7F2]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rp-well rounded-2xl p-4 text-center">
          <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#879287]">
            Placar final
          </p>
          <p className="mt-1.5 text-lg font-extrabold text-[#F4F7F2]">
            {teamA.name}{' '}
            <span className="font-mono text-xl font-extrabold text-[#BEF264]">{scoreA}</span>{' '}
            <span className="font-mono text-[#4B554C]">×</span>{' '}
            <span className="font-mono text-xl font-extrabold text-[#BEF264]">{scoreB}</span>{' '}
            {teamB.name}
          </p>
        </div>

        {isDraw && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#FBBF24]/45 bg-[#FBBF24]/10 p-3.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FBBF24]" />
            <div>
              <p className="text-sm font-extrabold text-[#FDE68A]">
                Empate {scoreA} × {scoreB}
              </p>
              <p className="text-xs text-[#FDE68A]/80">
                Decida quem fica na quadra (vantagem, pênaltis ou saem os dois).
              </p>
            </div>
          </div>
        )}

        {teamsCount <= 2 && (
          <p className="rp-well rounded-xl px-3 py-2.5 text-xs text-[#879287]">
            Só existem 2 times: a fila não muda, o placar é só arquivado.
          </p>
        )}

        <div className="space-y-2">
          <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
            Rotação da fila
          </p>

          {isDraw ? (
            <>
              <button
                type="button"
                onClick={() => onConfirm('both_leave')}
                className="rp-btn-primary flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-4 text-left text-sm"
              >
                <RefreshCw className="h-4 w-4 shrink-0" />
                Ambos saem (entram os próximos)
              </button>
              <button
                type="button"
                onClick={() => onConfirm('team_a_stays')}
                className="rp-btn-secondary flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-4 text-left text-sm"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#BEF264]" />
                <span>
                  {teamA.name} fica{' '}
                  <span className="text-xs font-medium text-[#879287]">(vantagem / pênaltis)</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onConfirm('team_b_stays')}
                className="rp-btn-secondary flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-4 text-left text-sm"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#BEF264]" />
                <span>
                  {teamB.name} fica{' '}
                  <span className="text-xs font-medium text-[#879287]">(vantagem / pênaltis)</span>
                </span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onConfirm('winner_stays')}
                className="rp-btn-primary flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-4 text-left text-sm"
              >
                <Trophy className="h-4 w-4 shrink-0" />
                {winner.name} ganhou e fica na quadra
              </button>
              <button
                type="button"
                onClick={() => onConfirm('both_leave')}
                className="rp-btn-secondary flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-4 text-left text-sm"
              >
                <RefreshCw className="h-4 w-4 shrink-0 text-[#BEF264]" />
                Os dois times saem (entram os próximos)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onConfirm('team_a_stays')}
                  className="rp-well min-h-[46px] rounded-2xl px-3 text-xs font-bold text-[#C9D3C4] hover:border-[#BEF264]/35 hover:text-[#F4F7F2]"
                >
                  Manter {teamA.name}
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm('team_b_stays')}
                  className="rp-well min-h-[46px] rounded-2xl px-3 text-xs font-bold text-[#C9D3C4] hover:border-[#BEF264]/35 hover:text-[#F4F7F2]"
                >
                  Manter {teamB.name}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
