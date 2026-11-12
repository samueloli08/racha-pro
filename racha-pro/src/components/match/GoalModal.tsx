import React, { useState } from 'react';
import { X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">
            ⚽ Gol — <span style={{ color: team.color }}>{team.name}</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-full bg-zinc-800 p-1.5 text-zinc-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!scorerId ? (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              1. Quem marcou o gol?
            </p>
            <div className="grid grid-cols-1 gap-2">
              {teamPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setScorerId(player.id)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm font-bold text-white transition hover:border-emerald-500"
                >
                  {player.name}
                </button>
              ))}
              <button
                onClick={() => onConfirm('own_goal', null)}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm font-bold text-red-400"
              >
                Gol Contra
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              2. Quem deu a assistência?
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleSelectAssist(null)}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-left text-sm font-bold text-emerald-300"
              >
                Jogada Individual / Sem Assistência
              </button>
              {teamPlayers
                .filter((p) => p.id !== scorerId)
                .map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleSelectAssist(player.id)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm font-bold text-white transition hover:border-emerald-500"
                  >
                    👟 {player.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
