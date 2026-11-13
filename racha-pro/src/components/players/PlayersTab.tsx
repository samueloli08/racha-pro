import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  Pencil,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { Player } from '../../types/racha';
import { useToast } from '../ui/Toast';

type PlayerFilter = 'all' | 'present' | 'absent' | 'gk';

interface PlayersTabProps {
  players: Player[];
  onAddPlayer: (name: string, isGoalkeeper: boolean, skill: number) => string | null;
  onTogglePresence: (id: string) => void;
  onSetAllPresence: (present: boolean) => void;
  onUpdatePlayer: (
    id: string,
    patch: Partial<Pick<Player, 'name' | 'isGoalkeeper' | 'skill'>>
  ) => void;
  onRemovePlayer: (id: string) => void;
  onLoadMockPlayers: () => void;
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const StarPicker: React.FC<{ value: number; onChange: (v: number) => void }> = ({
  value,
  onChange,
}) => (
  <div className="flex items-center">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        className="flex h-11 w-9 items-center justify-center"
        aria-label={`Nível ${star}`}
      >
        <Star
          className={`h-5 w-5 ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`}
        />
      </button>
    ))}
  </div>
);

interface PlayerEditorProps {
  player: Player;
  onSave: (patch: Pick<Player, 'name' | 'isGoalkeeper' | 'skill'>) => void;
  onCancel: () => void;
}

const PlayerEditor: React.FC<PlayerEditorProps> = ({ player, onSave, onCancel }) => {
  const [name, setName] = useState(player.name);
  const [isGoalkeeper, setIsGoalkeeper] = useState(player.isGoalkeeper);
  const [skill, setSkill] = useState(player.skill);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name, isGoalkeeper, skill });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-xl border border-amber-500/40 bg-zinc-900 p-3"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 text-base text-white focus:border-emerald-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsGoalkeeper(!isGoalkeeper)}
          className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
            isGoalkeeper
              ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
              : 'border-zinc-800 bg-zinc-950 text-zinc-400'
          }`}
        >
          <Shield className="h-4 w-4" />
          {isGoalkeeper ? 'Goleiro' : 'Linha'}
        </button>
        <StarPicker value={skill} onChange={setSkill} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 text-sm font-bold text-zinc-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="min-h-[44px] rounded-xl bg-emerald-500 text-sm font-extrabold text-zinc-950 active:scale-95"
        >
          Salvar
        </button>
      </div>
    </form>
  );
};

export const PlayersTab: React.FC<PlayersTabProps> = ({
  players,
  onAddPlayer,
  onTogglePresence,
  onSetAllPresence,
  onUpdatePlayer,
  onRemovePlayer,
  onLoadMockPlayers,
}) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [skill, setSkill] = useState(3);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlayerFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const added = name.trim();
    onAddPlayer(name, isGoalkeeper, skill);
    toast.show(`${added} adicionado`);
    setName('');
    setIsGoalkeeper(false);
    setSkill(3);
  };

  const presentCount = players.filter((p) => p.present).length;

  // Posição de chegada (#1, #2...) entre os presentes
  const arrivalRank = useMemo(() => {
    const ordered = players
      .filter((p) => p.present)
      .sort((a, b) => (a.checkInOrder ?? 0) - (b.checkInOrder ?? 0));
    return new Map(ordered.map((p, idx) => [p.id, idx + 1]));
  }, [players]);

  const counts = useMemo(
    () => ({
      all: players.length,
      present: presentCount,
      absent: players.length - presentCount,
      gk: players.filter((p) => p.isGoalkeeper).length,
    }),
    [players, presentCount]
  );

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return players.filter((p) => {
      if (q && !normalize(p.name).includes(q)) return false;
      if (filter === 'present') return p.present;
      if (filter === 'absent') return !p.present;
      if (filter === 'gk') return p.isGoalkeeper;
      return true;
    });
  }, [players, query, filter]);

  const filters: { id: PlayerFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'present', label: 'Presentes' },
    { id: 'absent', label: 'Ausentes' },
    { id: 'gk', label: 'Goleiros' },
  ];

  const handleRemove = (player: Player) => {
    if (!window.confirm(`Remover ${player.name} do cadastro?`)) return;
    onRemovePlayer(player.id);
    toast.show(`${player.name} removido`, 'info');
  };

  return (
    <div className="space-y-4">
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
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 text-base text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 transition active:scale-95"
          >
            <UserPlus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsGoalkeeper(!isGoalkeeper)}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
              isGoalkeeper
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400'
            }`}
          >
            <Shield className="h-4 w-4" />
            {isGoalkeeper ? 'Goleiro' : 'Linha'}
          </button>

          <div className="flex items-center">
            <span className="mr-1 text-xs text-zinc-400">Nível:</span>
            <StarPicker value={skill} onChange={setSkill} />
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          Presença ({presentCount}/{players.length})
        </h2>
        {players.length === 0 && (
          <button
            onClick={onLoadMockPlayers}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Carregar 15 Teste
          </button>
        )}
      </div>

      {players.length > 0 && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar jogador..."
              className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-10 text-base text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-zinc-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`min-h-[44px] rounded-xl border px-1 text-[11px] font-bold transition ${
                  filter === f.id
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                {f.label}
                <span className="ml-1 text-[10px] opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onSetAllPresence(true);
                toast.show('Todos marcados como presentes');
              }}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-400 active:scale-95"
            >
              <CheckCheck className="h-4 w-4" /> Marcar Todos
            </button>
            <button
              onClick={() => {
                onSetAllPresence(false);
                toast.show('Todos desmarcados', 'info');
              }}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-300 active:scale-95"
            >
              <XCircle className="h-4 w-4" /> Desmarcar Todos
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {visible.length === 0 && players.length > 0 && (
          <p className="py-6 text-center text-xs text-zinc-500">
            Nenhum jogador encontrado com esse filtro.
          </p>
        )}

        {visible.map((player) => {
          if (editingId === player.id) {
            return (
              <PlayerEditor
                key={player.id}
                player={player}
                onCancel={() => setEditingId(null)}
                onSave={(patch) => {
                  onUpdatePlayer(player.id, patch);
                  setEditingId(null);
                  toast.show('Jogador atualizado');
                }}
              />
            );
          }

          const rank = arrivalRank.get(player.id);

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl border pl-3 transition ${
                player.present
                  ? 'border-emerald-500/40 bg-zinc-900'
                  : 'border-zinc-800/70 bg-zinc-950/60 opacity-60'
              }`}
            >
              <button
                onClick={() => onTogglePresence(player.id)}
                className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${
                    player.present
                      ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border-zinc-700 bg-zinc-900'
                  }`}
                >
                  {player.present && <Check className="h-4 w-4 stroke-[3]" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-white">{player.name}</span>
                    {player.isGoalkeeper && (
                      <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                        GK
                      </span>
                    )}
                    {rank !== undefined && (
                      <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        #{rank}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 pt-0.5">
                    {Array.from({ length: player.skill }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-amber-400/80 text-amber-400/80" />
                    ))}
                  </div>
                </div>
              </button>

              <div className="flex shrink-0 items-center">
                <button
                  onClick={() => setEditingId(player.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-amber-300"
                  aria-label={`Editar ${player.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleRemove(player)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                  aria-label={`Remover ${player.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
