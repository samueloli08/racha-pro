import React, { useState } from 'react';
import { Swords, X } from 'lucide-react';
import { Team } from '../../types/racha';

interface MatchupModalProps {
  teams: Team[];
  currentAId: string;
  currentBId: string;
  onConfirm: (teamAId: string, teamBId: string) => void;
  onClose: () => void;
}

export const MatchupModal: React.FC<MatchupModalProps> = ({
  teams,
  currentAId,
  currentBId,
  onConfirm,
  onClose,
}) => {
  const [aId, setAId] = useState(currentAId);
  const [bId, setBId] = useState(currentBId);
  const invalid = aId === bId;

  const renderSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[48px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-base font-bold text-white focus:border-emerald-500 focus:outline-none"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md animate-sheet-in space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
            <Swords className="h-5 w-5 text-emerald-400" /> Escolher Confronto
          </h3>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-400"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {renderSelect('Time A', aId, setAId)}
        {renderSelect('Time B', bId, setBId)}

        {invalid && (
          <p className="text-xs font-semibold text-red-400">Escolha dois times diferentes.</p>
        )}
        <p className="text-xs text-zinc-500">
          Os dois times escolhidos vão para o início da fila. O placar da partida atual é zerado.
        </p>

        <button
          onClick={() => onConfirm(aId, bId)}
          disabled={invalid}
          className="min-h-[48px] w-full rounded-xl bg-emerald-500 text-sm font-extrabold text-zinc-950 transition active:scale-95 disabled:opacity-40"
        >
          Confirmar confronto
        </button>
      </div>
    </div>
  );
};
