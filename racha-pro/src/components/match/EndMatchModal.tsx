import React from 'react';
import { AlertTriangle, Flag, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md animate-sheet-in space-y-4 overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
            <Flag className="h-5 w-5 text-emerald-400" /> Encerrar Partida
          </h3>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-400"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl bg-zinc-950 p-4 text-center">
          <p className="text-xs text-zinc-400">Placar Final</p>
          <p className="mt-1 text-xl font-black text-white">
            {teamA.name} {scoreA} x {scoreB} {teamB.name}
          </p>
        </div>

        {isDraw && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-extrabold text-amber-300">
                Empate {scoreA} x {scoreB}
              </p>
              <p className="text-xs text-amber-200/80">
                Decida quem fica na quadra (vantagem, pênaltis ou saem os dois).
              </p>
            </div>
          </div>
        )}

        {teamsCount <= 2 && (
          <p className="rounded-xl bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            Só existem 2 times: a fila não muda, o placar é só arquivado.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Rotação da Fila para Próximo Jogo:
          </p>

          {isDraw ? (
            <>
              <button
                onClick={() => onConfirm('both_leave')}
                className="min-h-[52px] w-full rounded-xl bg-emerald-500 px-4 text-left text-sm font-extrabold text-zinc-950"
              >
                🔄 Ambos saem (entram os próximos)
              </button>
              <button
                onClick={() => onConfirm('team_a_stays')}
                className="min-h-[52px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-left text-sm font-bold text-white"
              >
                ✅ {teamA.name} fica{' '}
                <span className="text-xs font-medium text-zinc-400">(vantagem / pênaltis)</span>
              </button>
              <button
                onClick={() => onConfirm('team_b_stays')}
                className="min-h-[52px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-left text-sm font-bold text-white"
              >
                ✅ {teamB.name} fica{' '}
                <span className="text-xs font-medium text-zinc-400">(vantagem / pênaltis)</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConfirm('winner_stays')}
                className="min-h-[52px] w-full rounded-xl bg-emerald-500 px-4 text-left text-sm font-extrabold text-zinc-950"
              >
                🏆 {winner.name} ganhou e fica na quadra
              </button>
              <button
                onClick={() => onConfirm('both_leave')}
                className="min-h-[52px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-left text-sm font-bold text-white"
              >
                🔄 Os dois times saem (entram os próximos)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onConfirm('team_a_stays')}
                  className="min-h-[48px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-bold text-zinc-300"
                >
                  Manter {teamA.name}
                </button>
                <button
                  onClick={() => onConfirm('team_b_stays')}
                  className="min-h-[48px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-bold text-zinc-300"
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
