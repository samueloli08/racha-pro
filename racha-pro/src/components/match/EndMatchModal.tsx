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
        className="rp-card max-h-[92vh] w-full max-w-md animate-sheet-in space-y-4 overflow-y-auto rounded-[28px] bg-white p-5 text-[#0D1510]"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.03em] text-[#0D1510]">
            <Flag className="h-4 w-4 text-[#3F6212]" /> Encerrar partida
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#0D1510]/10 bg-[#F6F9F2] text-[#647468] hover:text-[#0D1510]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rp-well rounded-2xl p-4 text-center">
          <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#647468]">
            Placar final
          </p>
          <p className="mt-1.5 text-lg font-extrabold text-[#0D1510]">
            {teamA.name}{' '}
            <span className="font-mono text-2xl font-extrabold text-[#3F6212]">{scoreA}</span>{' '}
            <span className="font-mono text-[#A8B8A4]">×</span>{' '}
            <span className="font-mono text-2xl font-extrabold text-[#3F6212]">{scoreB}</span>{' '}
            {teamB.name}
          </p>
        </div>

        {isDraw && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#D97706]/35 bg-[#FEF3C7] p-3.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" />
            <div>
              <p className="text-sm font-extrabold text-[#92400E]">
                Empate {scoreA} × {scoreB}
              </p>
              <p className="text-xs text-[#78350F]">
                Decida quem fica na quadra (vantagem, pênaltis ou saem os dois).
              </p>
            </div>
          </div>
        )}

        {teamsCount <= 2 && (
          <p className="rp-well rounded-xl px-3 py-2.5 text-xs text-[#647468]">
            Só existem 2 times: a fila não muda, o placar é só arquivado.
          </p>
        )}

        <div className="space-y-2">
          <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
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
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3F6212]" />
                <span>
                  {teamA.name} fica{' '}
                  <span className="text-xs font-medium text-[#647468]">(vantagem / pênaltis)</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onConfirm('team_b_stays')}
                className="rp-btn-secondary flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-4 text-left text-sm"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3F6212]" />
                <span>
                  {teamB.name} fica{' '}
                  <span className="text-xs font-medium text-[#647468]">(vantagem / pênaltis)</span>
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
                <RefreshCw className="h-4 w-4 shrink-0 text-[#3F6212]" />
                Os dois times saem (entram os próximos)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onConfirm('team_a_stays')}
                  className="rp-well min-h-[46px] rounded-2xl px-3 text-xs font-bold text-[#3A473E] hover:border-[#84CC16] hover:text-[#365314]"
                >
                  Manter {teamA.name}
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm('team_b_stays')}
                  className="rp-well min-h-[46px] rounded-2xl px-3 text-xs font-bold text-[#3A473E] hover:border-[#84CC16] hover:text-[#365314]"
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
