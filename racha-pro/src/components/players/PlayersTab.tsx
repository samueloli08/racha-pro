import React, { useState } from 'react';
import { Check, Shield, Sparkles, Star, Trash2, UserPlus } from 'lucide-react';
import { Player } from '../../types/racha';

interface PlayersTabProps {
  players: Player[];
  onAddPlayer: (name: string, isGoalkeeper: boolean, skill: number) => void;
  onTogglePresence: (id: string) => void;
  onRemovePlayer: (id: string) => void;
  onLoadMockPlayers: () => void;
}

export const PlayersTab: React.FC<PlayersTabProps> = ({
  players,
  onAddPlayer,
  onTogglePresence,
  onRemovePlayer,
  onLoadMockPlayers,
}) => {
  const [name, setName] = useState('');
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [skill, setSkill] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddPlayer(name, isGoalkeeper, skill);
    setName('');
    setIsGoalkeeper(false);
    setSkill(3);
  };

  const presentCount = players.filter((p) => p.present).length;

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do jogador..."
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 transition active:scale-95"
          >
            <UserPlus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIsGoalkeeper(!isGoalkeeper)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              isGoalkeeper
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            {isGoalkeeper ? 'Goleiro' : 'Linha'}
          </button>

          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-zinc-400">Nível:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setSkill(star)}
                className="p-0.5"
              >
                <Star
                  className={`h-4 w-4 ${
                    star <= skill
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-zinc-700'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          Lista de Presença ({presentCount}/{players.length})
        </h2>
        {players.length === 0 && (
          <button
            onClick={onLoadMockPlayers}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Carregar 15 Jogadores Teste
          </button>
        )}
      </div>

      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center justify-between rounded-xl border p-3 transition ${
              player.present
                ? 'border-emerald-500/40 bg-zinc-900'
                : 'border-zinc-800/70 bg-zinc-950/60 opacity-60'
            }`}
          >
            <button
              onClick={() => onTogglePresence(player.id)}
              className="flex flex-1 items-center gap-3 text-left"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                  player.present
                    ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                    : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                {player.present && <Check className="h-4 w-4 stroke-[3]" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{player.name}</span>
                  {player.isGoalkeeper && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      GK
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 pt-0.5">
                  {Array.from({ length: player.skill }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3 w-3 fill-amber-400/80 text-amber-400/80"
                    />
                  ))}
                </div>
              </div>
            </button>

            <button
              onClick={() => onRemovePlayer(player.id)}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              aria-label="Remover jogador"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
