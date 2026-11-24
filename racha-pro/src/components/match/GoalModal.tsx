import React, { useState } from 'react';
import { CornerDownRight, ShieldAlert, UserCheck, X } from 'lucide-react';
import { Player, Team } from '../../types/racha';

interface GoalModalProps {
  team: Team;
  players: Player[];
  onConfirm: (scorerId: string | 'own_goal', assistId: string | null) => void;
  onClose: () => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  team,
  players,
  onConfirm,
  onClose,
}) => {
  const [scorerId, setScorerId] = useState<string | 'own_goal' | null>(null);

  const teamPlayers = players.filter((p) => team.playerIds.includes(p.id));

  const handleSelectAssist = (assistId: string | null) => {
    if (!scorerId) return;
    onConfirm(scorerId, assistId);
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rp-card max-h-[90vh] w-full max-w-md animate-sheet-in space-y-4 overflow-y-auto rounded-[28px] p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="rp-eyebrow">{scorerId ? 'PASSO 2 DE 2' : 'PASSO 1 DE 2'}</p>
            <h3 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
              <i
                className="block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="truncate">Gol · {team.name}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.085] bg-[#0B100D] text-[#879287] hover:text-[#F4F7F2]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!scorerId ? (
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
              Quem marcou o gol?
            </p>
            <div className="grid grid-cols-1 gap-2">
              {teamPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setScorerId(player.id)}
                  className="rp-well flex min-h-[48px] items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#F4F7F2] transition hover:border-[#BEF264]/45 hover:text-[#D9F99D]"
                >
                  <span className="truncate">{player.name}</span>
                  {player.isGoalkeeper && (
                    <span className="font-mono text-[10px] font-extrabold text-[#FDE68A]">GOL</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onConfirm('own_goal', null)}
                className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-left text-sm font-bold text-[#FCA5A5] transition hover:bg-[#F87171]/18"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Gol contra
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
              Quem deu a assistência?
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleSelectAssist(null)}
                className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#BEF264]/40 bg-[#84CC16]/12 px-4 py-3 text-left text-sm font-extrabold text-[#D9F99D] transition hover:bg-[#84CC16]/20"
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                Jogada individual / sem assistência
              </button>
              {teamPlayers
                .filter((p) => p.id !== scorerId)
                .map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelectAssist(player.id)}
                    className="rp-well flex min-h-[48px] items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#F4F7F2] transition hover:border-[#BEF264]/45 hover:text-[#D9F99D]"
                  >
                    <CornerDownRight className="h-4 w-4 shrink-0 text-[#879287]" />
                    <span className="truncate">{player.name}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
