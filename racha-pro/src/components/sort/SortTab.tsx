import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  Palette,
  Pencil,
  Play,
  Shuffle,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import { Player, SortMode, Team } from '../../types/racha';
import { copyText } from '../../utils/clipboard';
import { TEAM_PRESETS } from '../../utils/teamBalancer';
import { buildLineupText } from '../../utils/whatsappFormatter';
import { useToast } from '../ui/Toast';

interface SortTabProps {
  players: Player[];
  teams: Team[];
  playersPerTeam: number;
  sortMode: SortMode;
  onUpdateSettings: (playersPerTeam: number, mode: SortMode) => void;
  onRunSort: () => void;
  onSwapPlayers: (tA: string, pA: string, tB: string, pB: string) => void;
  onRenameTeam: (teamId: string, name: string) => void;
  onSetTeamColor: (teamId: string, color: string) => void;
  onAddPlayer: (name: string, isGoalkeeper: boolean, skill: number) => string | null;
  onAddPlayerToTeam: (playerId: string, teamId: string) => void;
  onGoToMatch: () => void;
}

interface TeamNameProps {
  team: Team;
  onRename: (name: string) => void;
}

const TeamName: React.FC<TeamNameProps> = ({ team, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.name);

  const commit = () => {
    if (draft.trim() && draft.trim() !== team.name) onRename(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        maxLength={24}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-emerald-500 bg-zinc-950 px-3 text-base font-bold text-white focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(team.name);
        setEditing(true);
      }}
      className="flex min-h-[44px] min-w-0 items-center gap-1.5 text-left"
      aria-label={`Renomear ${team.name}`}
    >
      <h3 className="truncate font-bold text-white">{team.name}</h3>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
    </button>
  );
};

export const SortTab: React.FC<SortTabProps> = ({
  players,
  teams,
  playersPerTeam,
  sortMode,
  onUpdateSettings,
  onRunSort,
  onSwapPlayers,
  onRenameTeam,
  onSetTeamColor,
  onAddPlayer,
  onAddPlayerToTeam,
  onGoToMatch,
}) => {
  const toast = useToast();
  const [selectedSwap, setSelectedSwap] = useState<{ teamId: string; playerId: string } | null>(
    null
  );
  const [colorPickerTeamId, setColorPickerTeamId] = useState<string | null>(null);
  const [lateName, setLateName] = useState('');
  const [lateTeamId, setLateTeamId] = useState('');

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const presentCount = players.filter((p) => p.present).length;

  const assignedIds = new Set(teams.flatMap((t) => t.playerIds));
  const lateArrivals = players.filter((p) => p.present && !assignedIds.has(p.id));
  const lastTeam = teams[teams.length - 1];
  const selectedPlayer = selectedSwap ? playerMap.get(selectedSwap.playerId) : undefined;

  const handlePlayerClick = (teamId: string, playerId: string) => {
    if (!selectedSwap) {
      setSelectedSwap({ teamId, playerId });
      return;
    }
    if (selectedSwap.teamId !== teamId || selectedSwap.playerId !== playerId) {
      onSwapPlayers(selectedSwap.teamId, selectedSwap.playerId, teamId, playerId);
      toast.show('Jogadores trocados');
    }
    setSelectedSwap(null);
  };

  const handleCopyLineup = async () => {
    const ok = await copyText(buildLineupText(teams, players));
    toast.show(ok ? 'Escalação copiada!' : 'Não foi possível copiar', ok ? 'success' : 'error');
  };

  const addLateToTeam = (playerId: string, teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    const player = playerMap.get(playerId);
    if (!team || !player) return;
    onAddPlayerToTeam(playerId, teamId);
    toast.show(`${player.name} entrou no ${team.name}`);
  };

  const handleNewLate = (e: React.FormEvent) => {
    e.preventDefault();
    const target = teams.find((t) => t.id === (lateTeamId || lastTeam?.id));
    if (!target || !lateName.trim()) return;
    const newId = onAddPlayer(lateName, false, 3);
    if (!newId) return;
    onAddPlayerToTeam(newId, target.id);
    toast.show(`${lateName.trim()} entrou no ${target.name}`);
    setLateName('');
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
                className={`min-h-[44px] rounded-xl text-sm font-bold transition ${
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
              className={`min-h-[44px] rounded-xl border text-xs font-bold transition ${
                sortMode === 'balanced'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
              }`}
            >
              ⚖️ Equilibrado (Nível + GK)
            </button>
            <button
              onClick={() => onUpdateSettings(playersPerTeam, 'random')}
              className={`min-h-[44px] rounded-xl border text-xs font-bold transition ${
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
          onClick={() => {
            onRunSort();
            setSelectedSwap(null);
            toast.show('Times sorteados!');
          }}
          disabled={presentCount < 2}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-40"
        >
          <Shuffle className="h-4 w-4 stroke-[2.5]" />
          Sortear Times ({presentCount} presentes)
        </button>
      </div>

      {teams.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLineup}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 text-xs font-bold text-emerald-400 active:scale-95"
            >
              <ClipboardCopy className="h-4 w-4" /> Copiar Escalação
            </button>
            <button
              onClick={onGoToMatch}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-800 px-2 text-xs font-bold text-emerald-400 hover:bg-zinc-700 active:scale-95"
            >
              <Play className="h-4 w-4" /> Ir para Quadra
            </button>
          </div>

          {selectedSwap ? (
            <div className="sticky top-[60px] z-20 flex items-center justify-between gap-2 rounded-2xl border border-amber-400 bg-zinc-900/95 p-2 pl-4 backdrop-blur">
              <p className="min-w-0 text-xs text-amber-200">
                <span className="font-bold">Trocando:</span>{' '}
                <span className="font-extrabold text-white">{selectedPlayer?.name ?? 'Jogador'}</span>
                <br />
                Toque em outro jogador para trocar
              </p>
              <button
                onClick={() => setSelectedSwap(null)}
                className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl bg-amber-400 px-3 text-xs font-extrabold text-zinc-950 active:scale-95"
              >
                <X className="h-4 w-4" /> Cancelar troca
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Toque em dois jogadores para trocar manualmente</p>
          )}

          {teams.map((team, idx) => {
            const teamPlayers = team.playerIds
              .map((id) => playerMap.get(id))
              .filter((p): p is Player => Boolean(p));

            const avgSkill =
              teamPlayers.length > 0
                ? (teamPlayers.reduce((acc, p) => acc + p.skill, 0) / teamPlayers.length).toFixed(1)
                : '0.0';

            return (
              <div
                key={team.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      onClick={() =>
                        setColorPickerTeamId(colorPickerTeamId === team.id ? null : team.id)
                      }
                      className="flex h-11 w-9 shrink-0 items-center justify-center"
                      aria-label={`Trocar cor do ${team.name}`}
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-zinc-700"
                        style={{ backgroundColor: team.color }}
                      >
                        <Palette className="h-3 w-3 text-zinc-950/70" />
                      </span>
                    </button>
                    <TeamName team={team} onRename={(name) => onRenameTeam(team.id, name)} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-300">
                      {idx === 0 ? 'Em Campo (A)' : idx === 1 ? 'Em Campo (B)' : `Próximo #${idx - 1}`}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                      <Star className="h-3.5 w-3.5 fill-amber-400" /> {avgSkill}
                    </span>
                  </div>
                </div>

                {colorPickerTeamId === team.id && (
                  <div className="mb-3 grid grid-cols-6 gap-2">
                    {TEAM_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => {
                          onSetTeamColor(team.id, preset.color);
                          setColorPickerTeamId(null);
                        }}
                        className="flex h-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950"
                        aria-label={`Cor ${preset.name}`}
                      >
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full"
                          style={{ backgroundColor: preset.color }}
                        >
                          {team.color.toLowerCase() === preset.color && (
                            <Check className="h-4 w-4 text-zinc-950" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-1.5">
                  {teamPlayers.map((p) => {
                    const isSelected =
                      selectedSwap?.teamId === team.id && selectedSwap?.playerId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePlayerClick(team.id, p.id)}
                        className={`flex min-h-[44px] items-center justify-between rounded-xl border px-3 text-left text-sm transition ${
                          isSelected
                            ? 'animate-swap-pulse border-amber-400 bg-amber-500/20 text-white'
                            : selectedSwap
                            ? 'border-zinc-700 bg-zinc-950/70 text-zinc-200 hover:border-amber-400/60'
                            : 'border-zinc-800/80 bg-zinc-950/70 text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {p.name}{' '}
                          {p.isGoalkeeper && (
                            <span className="ml-1 text-xs font-bold text-amber-400">(GK)</span>
                          )}
                        </span>
                        <ArrowLeftRight
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isSelected ? 'text-amber-300' : 'text-zinc-500'
                          }`}
                        />
                      </button>
                    );
                  })}
                  {teamPlayers.length === 0 && (
                    <p className="py-2 text-xs text-zinc-500">Time vazio.</p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              ⏱️ Chegou Atrasado
            </h3>

            {lateArrivals.length > 0 && (
              <div className="space-y-2">
                {lateArrivals.map((p) => (
                  <div
                    key={p.id}
                    className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
                  >
                    <p className="truncate text-sm font-semibold text-white">
                      {p.name}{' '}
                      {p.isGoalkeeper && <span className="text-xs text-amber-400">(GK)</span>}
                      <span className="ml-2 text-[11px] font-medium text-zinc-500">sem time</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => lastTeam && addLateToTeam(p.id, lastTeam.id)}
                        className="min-h-[44px] truncate rounded-xl bg-emerald-500 px-2 text-xs font-extrabold text-zinc-950 active:scale-95"
                      >
                        Último da fila
                      </button>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addLateToTeam(p.id, e.target.value);
                        }}
                        className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-xs font-bold text-white"
                        aria-label={`Escolher time para ${p.name}`}
                      >
                        <option value="">Escolher time...</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleNewLate} className="space-y-2">
              <p className="text-xs text-zinc-400">
                {lateArrivals.length === 0
                  ? 'Todos os presentes já estão em um time. Chegou mais alguém?'
                  : 'Ou cadastre alguém novo direto em um time:'}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lateName}
                  onChange={(e) => setLateName(e.target.value)}
                  placeholder="Nome do jogador..."
                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-base text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
                <select
                  value={lateTeamId || lastTeam?.id || ''}
                  onChange={(e) => setLateTeamId(e.target.value)}
                  className="min-h-[44px] w-[38%] rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-xs font-bold text-white"
                  aria-label="Time de destino"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!lateName.trim()}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-400 active:scale-95 disabled:opacity-40"
              >
                <UserPlus className="h-4 w-4" /> Adicionar ao time
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
