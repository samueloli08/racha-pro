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
  readOnly?: boolean;
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
    .replace(/[\u0300-\u036f]/g, '');

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
          className={`h-5 w-5 transition ${
            star <= value ? 'fill-[#FBBF24] text-[#FBBF24]' : 'text-[#313A32]'
          }`}
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
      className="rp-card space-y-3 rounded-[20px] border-[#FBBF24]/45 p-3.5"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="rp-input w-full rounded-xl px-3.5 text-base font-semibold"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsGoalkeeper(!isGoalkeeper)}
          className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
            isGoalkeeper
              ? 'border-[#FBBF24]/45 bg-[#FBBF24]/15 text-[#FDE68A]'
              : 'border-white/[0.085] bg-[#0B100D] text-[#879287]'
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
          className="rp-btn-secondary min-h-[44px] rounded-xl text-xs"
        >
          Cancelar
        </button>
        <button type="submit" className="rp-btn-primary min-h-[44px] rounded-xl text-xs">
          Salvar
        </button>
      </div>
    </form>
  );
};

export const PlayersTab: React.FC<PlayersTabProps> = ({
  players,
  readOnly = false,
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
      {!readOnly && (
        <form onSubmit={handleSubmit} className="rp-card space-y-3 rounded-[24px] p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do jogador..."
              className="rp-input min-w-0 flex-1 rounded-2xl px-3.5 text-base"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="rp-btn-primary flex min-h-[46px] shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 text-sm disabled:opacity-40"
            >
              <UserPlus className="h-4 w-4 stroke-[2.5]" />
              Add
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsGoalkeeper(!isGoalkeeper)}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
                isGoalkeeper
                  ? 'border-[#FBBF24]/45 bg-[#FBBF24]/15 text-[#FDE68A]'
                  : 'border-white/[0.085] bg-[#0B100D] text-[#879287] hover:text-[#C9D3C4]'
              }`}
            >
              <Shield className="h-4 w-4" />
              {isGoalkeeper ? 'Goleiro' : 'Linha'}
            </button>

            <div className="flex items-center">
              <span className="mr-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#879287]">
                Nível
              </span>
              <StarPicker value={skill} onChange={setSkill} />
            </div>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <h3 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#879287]">
          Presença · <span className="text-[#BEF264]">{presentCount}</span>/{players.length}
        </h3>
        {!readOnly && players.length === 0 && (
          <button
            type="button"
            onClick={onLoadMockPlayers}
            className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#BEF264]/30 bg-[#84CC16]/10 px-3 text-xs font-extrabold text-[#D9F99D] transition hover:bg-[#84CC16]/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Carregar 15 teste
          </button>
        )}
      </div>

      {players.length > 0 && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#879287]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar jogador..."
              className="rp-input w-full rounded-2xl pl-10 pr-10 text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="absolute right-0 top-0 flex h-[46px] w-11 items-center justify-center text-[#879287] hover:text-[#F4F7F2]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`min-h-[42px] rounded-xl border px-1 text-[11px] font-bold transition ${
                    active
                      ? 'border-[#BEF264]/45 bg-[#84CC16]/15 text-[#D9F99D]'
                      : 'border-white/[0.085] bg-[#111713] text-[#879287] hover:text-[#C9D3C4]'
                  }`}
                >
                  {f.label}
                  <span className="ml-1 font-mono text-[10px] opacity-75">{counts[f.id]}</span>
                </button>
              );
            })}
          </div>

          {!readOnly && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetAllPresence(true);
                  toast.show('Todos marcados como presentes');
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-[#BEF264]/30 bg-[#84CC16]/10 text-xs font-extrabold text-[#D9F99D] transition hover:bg-[#84CC16]/18"
              >
                <CheckCheck className="h-4 w-4" /> Marcar todos
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetAllPresence(false);
                  toast.show('Todos desmarcados', 'info');
                }}
                className="rp-btn-secondary flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-xs"
              >
                <XCircle className="h-4 w-4 text-[#879287]" /> Desmarcar todos
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {players.length === 0 && readOnly && (
          <p className="rp-surface rounded-[22px] py-8 text-center text-xs text-[#879287]">
            Nenhum jogador cadastrado neste racha ainda.
          </p>
        )}

        {visible.length === 0 && players.length > 0 && (
          <p className="py-6 text-center text-xs text-[#879287]">
            Nenhum jogador encontrado com esse filtro.
          </p>
        )}

        {visible.map((player) => {
          if (!readOnly && editingId === player.id) {
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

          const rowContent = (
            <>
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${
                  player.present
                    ? 'border-[#BEF264] bg-gradient-to-br from-[#D9F99D] to-[#A3E635] text-[#10160A]'
                    : 'border-white/[0.14] bg-[#0B100D]'
                }`}
              >
                {player.present && <Check className="h-4 w-4 stroke-[3]" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-[#F4F7F2]">{player.name}</span>
                  {player.isGoalkeeper && (
                    <span className="shrink-0 rounded-md border border-[#FBBF24]/35 bg-[#FBBF24]/12 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#FDE68A]">
                      GOL
                    </span>
                  )}
                  {rank !== undefined && (
                    <span className="shrink-0 rounded-md bg-[#84CC16]/15 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#BEF264]">
                      #{rank}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 pt-0.5">
                  {Array.from({ length: player.skill }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-[#FBBF24]/85 text-[#FBBF24]/85" />
                  ))}
                </div>
              </div>
            </>
          );

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-[18px] border px-3 transition ${
                player.present
                  ? 'border-[#BEF264]/28 bg-[#111713]'
                  : 'border-white/[0.06] bg-[#0B100D]/75 opacity-60'
              }`}
            >
              {readOnly ? (
                <div className="flex min-h-[58px] min-w-0 flex-1 items-center gap-3 text-left">
                  {rowContent}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onTogglePresence(player.id)}
                  className="flex min-h-[58px] min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {rowContent}
                </button>
              )}

              {!readOnly && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => setEditingId(player.id)}
                    className="flex h-11 w-10 items-center justify-center rounded-xl text-[#879287] hover:bg-white/[0.05] hover:text-[#FDE68A]"
                    aria-label={`Editar ${player.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(player)}
                    className="flex h-11 w-10 items-center justify-center rounded-xl text-[#879287] hover:bg-white/[0.05] hover:text-[#F87171]"
                    aria-label={`Remover ${player.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
