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
      <span className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rp-input min-h-[48px] w-full rounded-2xl px-3.5 text-base font-bold"
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
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rp-card w-full max-w-md animate-sheet-in space-y-4 rounded-[28px] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
            <Swords className="h-4 w-4 text-[#BEF264]" /> Escolher confronto
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

        {renderSelect('Time A', aId, setAId)}
        {renderSelect('Time B', bId, setBId)}

        {invalid && (
          <p className="text-xs font-semibold text-[#F87171]">Escolha dois times diferentes.</p>
        )}
        <p className="text-xs text-[#879287]">
          Os dois times escolhidos vão para o início da fila. O placar da partida atual é zerado.
        </p>

        <button
          type="button"
          onClick={() => onConfirm(aId, bId)}
          disabled={invalid}
          className="rp-btn-primary min-h-[48px] w-full rounded-2xl text-sm disabled:opacity-40"
        >
          Confirmar confronto
        </button>
      </div>
    </div>
  );
};
