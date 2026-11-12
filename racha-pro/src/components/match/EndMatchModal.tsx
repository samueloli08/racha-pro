import React from 'react';
import { Flag, X } from 'lucide-react';
import { RotationRule, Team } from '../../types/racha';

interface EndMatchModalProps {
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  onConfirm: (rule: RotationRule) => void;
  onClose: () => void;
}

export const EndMatchModal: React.FC<EndMatchModalProps> = ({
  teamA,
  teamB,
  scoreA,
  scoreB,
  onConfirm,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
            <Flag className="h-5 w-5 text-emerald-400" /> Encerrar Partida
          </h3>
          <button
            onClick={onClose}
            className="rounded-full bg-zinc-800 p-1.5 text-zinc-400"
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

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Rotação da Fila para Próximo Jogo:
          </p>
          <button
            onClick={() => onConfirm('winner_stays')}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-left text-sm font-extrabold text-zinc-950"
          >
            🏆 Quem ganhou fica na quadra
          </button>
          <button
            onClick={() => onConfirm('both_leave')}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-left text-sm font-bold text-white"
          >
            🔄 Os dois times saem (entram os próximos)
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onConfirm('team_a_stays')}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-bold text-zinc-300"
            >
              Manter {teamA.name}
            </button>
            <button
              onClick={() => onConfirm('team_b_stays')}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-bold text-zinc-300"
            >
              Manter {teamB.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
