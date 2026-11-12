import React, { useState } from 'react';
import { ArrowLeftRight, Play, Shuffle, Star } from 'lucide-react';
import { Player, SortMode, Team } from '../../types/racha';

interface SortTabProps {
  players: Player[];
  teams: Team[];
  playersPerTeam: number;
  sortMode: SortMode;
  onUpdateSettings: (playersPerTeam: number, mode: SortMode) => void;
  onRunSort: () => void;
  onSwapPlayers: (tA: string, pA: string, tB: string, pB: string) => void;
  onGoToMatch: () => void;
}

export const SortTab: React.FC<SortTabProps> = ({
  players,
  teams,
  playersPerTeam,
  sortMode,
  onUpdateSettings,
  onRunSort,
  onSwapPlayers,
  onGoToMatch,
}) => {
  const [selectedSwap, setSelectedSwap] = useState<{
    teamId: string;
    playerId: string;
  } | null>(null);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const presentCount = players.filter((p) => p.present).length;

  const handlePlayerClick = (teamId: string, playerId: string) => {
    if (!selectedSwap) {
      setSelectedSwap({ teamId, playerId });
      return;
    }
    onSwapPlayers(selectedSwap.teamId, selectedSwap.playerId, teamId, playerId);
    setSelectedSwap(null);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Jogadores por Time
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[4, 5, 6, 7, 8].map((num) => (
              <button
                key={num}
                onClick={() => onUpdateSettings(num, sortMode)}
                className={`rounded-xl py-2.5 text-sm font-bold transition ${
                  playersPerTeam === num
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {num}x{num}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Critério de Sorteio
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdateSettings(playersPerTeam, 'balanced')}
              className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                sortMode === 'balanced'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
              }`}
            >
              ⚖️ Equilibrado (Nível + GK)
            </button>
            <button
              onClick={() => onUpdateSettings(playersPerTeam, 'random')}
              className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                sortMode === 'random'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
              }`}
            >
              🎲 Aleatório Puro
            </button>
          </div>
        </div>

        <button
          onClick={onRunSort}
          disabled={presentCount < 2}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-40"
        >
          <Shuffle className="h-4 w-4 stroke-[2.5]" />
          Sortear Times ({presentCount} presentes)
        </button>
      </div>

      {teams.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              {selectedSwap
                ? 'Toque em outro jogador para trocar de time'
                : 'Toque em dois jogadores para trocar manualmente'}
            </p>
            <button
              onClick={onGoToMatch}
              className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-zinc-700"
            >
              <Play className="h-3.5 w-3.5" /> Ir para Quadra
            </button>
          </div>

          {teams.map((team, idx) => {
            const teamPlayers = team.playerIds
              .map((id) => playerMap.get(id))
              .filter((p): p is Player => Boolean(p));

            const avgSkill =
              teamPlayers.length > 0
                ? (
                    teamPlayers.reduce((acc, p) => acc + p.skill, 0) /
                    teamPlayers.length
                  ).toFixed(1)
                : '0.0';

            return (
              <div
                key={team.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <h3 className="font-bold text-white">{team.name}</h3>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-300">
                      {idx === 0
                        ? 'Em Campo (A)'
                        : idx === 1
                        ? 'Em Campo (B)'
                        : `Próximo #${idx - 1}`}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400" /> {avgSkill}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {teamPlayers.map((p) => {
                    const isSelected =
                      selectedSwap?.teamId === team.id &&
                      selectedSwap?.playerId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePlayerClick(team.id, p.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/20 text-white'
                            : 'border-zinc-800/80 bg-zinc-950/70 text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <span className="font-medium">
                          {p.name}{' '}
                          {p.isGoalkeeper && (
                            <span className="ml-1 text-xs font-bold text-amber-400">
                              (GK)
                            </span>
                          )}
                        </span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-500" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
