import React, { useState } from 'react';
import { CornerDownRight, ShieldAlert, UserCheck, X } from 'lucide-react';
import { Player, Team } from '../../types/racha';
import { safeHexColor } from '../../utils/color';

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
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="rp-card max-h-[90vh] w-full max-w-md animate-sheet-in space-y-4 overflow-y-auto rounded-[28px] bg-white p-5 text-[#0D1510]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="rp-eyebrow">{scorerId ? 'PASSO 2 DE 2' : 'PASSO 1 DE 2'}</p>
            <h3 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.03em] text-[#0D1510]">
              <i
                className="block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15"
                style={{ backgroundColor: safeHexColor(team.color) }}
              />
              <span className="truncate">Gol · {team.name}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0D1510]/10 bg-[#F6F9F2] text-[#647468] hover:text-[#0D1510]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!scorerId ? (
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
              Quem marcou o gol?
            </p>
            <div className="grid grid-cols-1 gap-2">
              {teamPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setScorerId(player.id)}
                  className="rp-well flex min-h-[48px] items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#0D1510] transition hover:border-[#84CC16] hover:bg-[#ECFCCB]/70 hover:text-[#365314]"
                >
                  <span className="truncate">{player.name}</span>
                  {player.isGoalkeeper && (
                    <span className="rounded bg-[#FEF3C7] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#92400E]">
                      GOL
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onConfirm('own_goal', null)}
                className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#DC2626]/30 bg-[#FEE2E2] px-4 py-3 text-left text-sm font-bold text-[#991B1B] transition hover:bg-[#FECACA]"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Gol contra
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
              Quem deu a assistência?
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleSelectAssist(null)}
                className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#65A30D]/40 bg-[#ECFCCB] px-4 py-3 text-left text-sm font-extrabold text-[#365314] transition hover:bg-[#D9F99D]"
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
                    className="rp-well flex min-h-[48px] items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#0D1510] transition hover:border-[#84CC16] hover:bg-[#ECFCCB]/70 hover:text-[#365314]"
                  >
                    <CornerDownRight className="h-4 w-4 shrink-0 text-[#647468]" />
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
