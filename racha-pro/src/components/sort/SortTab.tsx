import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  Clock,
  Dices,
  Palette,
  Pencil,
  Play,
  Scale,
  Shuffle,
  SlidersHorizontal,
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
  readOnly?: boolean;
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
        className="rp-input min-h-[40px] min-w-0 flex-1 rounded-xl px-3 text-sm font-bold"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(team.name);
        setEditing(true);
      }}
      className="group flex min-h-[40px] min-w-0 items-center gap-1.5 text-left"
      aria-label={`Renomear ${team.name}`}
    >
      <h3 className="truncate text-[16px] font-extrabold tracking-[-0.03em] text-[#F4F7F2] group-hover:text-[#D9F99D]">
        {team.name}
      </h3>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-[#879287] group-hover:text-[#BEF264]" />
    </button>
  );
};

export const SortTab: React.FC<SortTabProps> = ({
  players,
  teams,
  playersPerTeam,
  sortMode,
  readOnly = false,
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
  const [showConfig, setShowConfig] = useState(teams.length === 0);
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

  const configExpanded = teams.length === 0 || showConfig;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onRunSort();
                setSelectedSwap(null);
                setShowConfig(false);
                toast.show('Times sorteados!');
              }}
              disabled={presentCount < 2}
              className="rp-btn-primary flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[18px] px-4 text-[15px] disabled:opacity-40"
            >
              <Shuffle className="h-4 w-4 stroke-[2.5]" />
              {teams.length > 0
                ? 'Sortear de novo'
                : `Sortear times (${presentCount} presentes)`}
            </button>

            {teams.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfig((v) => !v)}
                aria-label="Configurar sorteio"
                title="Configurar formato e critério"
                className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] border transition ${
                  showConfig
                    ? 'border-[#BEF264]/45 bg-[#84CC16]/15 text-[#D9F99D]'
                    : 'border-white/[0.11] bg-[#111713] text-[#C9D3C4] hover:border-[#BEF264]/35'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>

          {configExpanded && (
            <div className="rp-surface space-y-4 rounded-[24px] p-4">
              <div>
                <label className="mb-2 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                  Jogadores por time
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[4, 5, 6, 7, 8].map((num) => {
                    const active = playersPerTeam === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onUpdateSettings(num, sortMode)}
                        className={`min-h-[44px] rounded-xl border font-mono text-xs font-extrabold transition ${
                          active
                            ? 'border-[#BEF264]/45 bg-[#84CC16]/15 text-[#D9F99D]'
                            : 'border-white/[0.085] bg-[#0B100D] text-[#879287] hover:text-[#F4F7F2]'
                        }`}
                      >
                        {num}x{num}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                  Critério do sorteio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings(playersPerTeam, 'balanced')}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition ${
                      sortMode === 'balanced'
                        ? 'border-[#BEF264]/45 bg-[#84CC16]/15 text-[#D9F99D]'
                        : 'border-white/[0.085] bg-[#0B100D] text-[#879287]'
                    }`}
                  >
                    <Scale className="h-3.5 w-3.5 shrink-0" />
                    Equilibrado
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings(playersPerTeam, 'random')}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition ${
                      sortMode === 'random'
                        ? 'border-[#BEF264]/45 bg-[#84CC16]/15 text-[#D9F99D]'
                        : 'border-white/[0.085] bg-[#0B100D] text-[#879287]'
                    }`}
                  >
                    <Dices className="h-3.5 w-3.5 shrink-0" />
                    Aleatório
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {teams.length === 0 && readOnly && (
        <div className="rp-card rounded-[24px] p-8 text-center">
          <p className="text-sm text-[#879287]">
            Os times ainda não foram sorteados pelo organizador.
          </p>
        </div>
      )}

      {teams.length > 0 && (
        <div className="space-y-3.5">
          {!readOnly &&
            (selectedSwap ? (
              <div className="sticky top-[70px] z-20 flex items-center justify-between gap-2 rounded-2xl border border-[#FBBF24]/60 bg-[#111713]/95 p-2.5 pl-4 shadow-xl shadow-black/40 backdrop-blur-xl">
                <p className="min-w-0 text-xs text-[#FDE68A]">
                  <span className="font-bold">Trocando:</span>{' '}
                  <span className="font-extrabold text-[#F4F7F2]">
                    {selectedPlayer?.name ?? 'Jogador'}
                  </span>
                  <span className="block text-[11px] text-[#C9D3C4]">
                    Toque em outro jogador para trocar de time
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedSwap(null)}
                  className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl bg-[#FBBF24] px-3 text-xs font-extrabold text-[#1A1405]"
                >
                  <X className="h-3.5 w-3.5" /> Cancelar
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-[#879287]">
                <ArrowLeftRight className="h-3.5 w-3.5 text-[#BEF264]" />
                Toque em dois jogadores para trocar manualmente
              </p>
            ))}

          {teams.map((team, idx) => {
            const teamPlayers = team.playerIds
              .map((id) => playerMap.get(id))
              .filter((p): p is Player => Boolean(p));

            const totalSkill = teamPlayers.reduce((acc, p) => acc + p.skill, 0);
            const isOnPitch = idx === 0 || idx === 1;

            return (
              <div key={team.id} className="rp-card space-y-3 rounded-[24px] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {readOnly ? (
                      <>
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <h3 className="truncate text-[16px] font-extrabold tracking-[-0.03em] text-[#F4F7F2]">
                          {team.name}
                        </h3>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setColorPickerTeamId(colorPickerTeamId === team.id ? null : team.id)
                          }
                          className="flex h-10 w-8 shrink-0 items-center justify-center rounded-xl hover:bg-white/[0.04]"
                          aria-label={`Trocar cor do ${team.name}`}
                          title="Trocar cor do colete"
                        >
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white/10"
                            style={{ backgroundColor: team.color }}
                          >
                            <Palette className="h-2.5 w-2.5 text-[#0B100D]/75" />
                          </span>
                        </button>
                        <TeamName team={team} onRename={(name) => onRenameTeam(team.id, name)} />
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[11px] font-extrabold tracking-[0.04em] text-[#879287] tabular-nums">
                      ★ {totalSkill} · {teamPlayers.length} JOG.
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] ${
                        isOnPitch
                          ? 'bg-[#84CC16]/15 text-[#BEF264]'
                          : 'bg-white/[0.05] text-[#879287]'
                      }`}
                    >
                      {idx === 0 ? 'Em campo A' : idx === 1 ? 'Em campo B' : `Próximo #${idx - 1}`}
                    </span>
                  </div>
                </div>

                {!readOnly && colorPickerTeamId === team.id && (
                  <div className="grid grid-cols-6 gap-2 pt-0.5">
                    {TEAM_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => {
                          onSetTeamColor(team.id, preset.color);
                          setColorPickerTeamId(null);
                        }}
                        className="rp-well flex h-11 items-center justify-center rounded-xl"
                        aria-label={`Cor ${preset.name}`}
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ backgroundColor: preset.color }}
                        >
                          {team.color.toLowerCase() === preset.color && (
                            <Check className="h-3.5 w-3.5 text-[#0B100D] stroke-[3]" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {teamPlayers.map((p) => {
                    const isSelected =
                      selectedSwap?.teamId === team.id && selectedSwap?.playerId === p.id;
                    const label = p.isGoalkeeper ? `Gol · ${p.name}` : p.name;

                    if (readOnly) {
                      return (
                        <span
                          key={p.id}
                          className={`inline-flex min-h-[38px] items-center rounded-[12px] border px-3 text-[13px] font-bold ${
                            p.isGoalkeeper
                              ? 'border-[#FBBF24]/45 bg-[#050907]/75 text-[#FDE68A]'
                              : 'border-white/[0.085] bg-[#050907]/75 text-[#F4F7F2]'
                          }`}
                        >
                          {label}
                        </span>
                      );
                    }

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePlayerClick(team.id, p.id)}
                        className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-[12px] border px-3 text-[13px] font-bold transition ${
                          isSelected
                            ? 'animate-swap-pulse border-[#FBBF24] bg-[#FBBF24]/20 text-[#FDE68A]'
                            : selectedSwap
                            ? 'border-white/[0.18] bg-[#050907]/80 text-[#F4F7F2] hover:border-[#FBBF24]/60'
                            : p.isGoalkeeper
                            ? 'border-[#FBBF24]/45 bg-[#050907]/75 text-[#FDE68A] hover:border-[#FBBF24]'
                            : 'border-white/[0.085] bg-[#050907]/75 text-[#F4F7F2] hover:border-[#BEF264]/35'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <ArrowLeftRight className="h-3.5 w-3.5 text-[#FBBF24]" />}
                      </button>
                    );
                  })}
                  {teamPlayers.length === 0 && (
                    <p className="py-1 text-xs text-[#879287]">Time vazio.</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Ações da Escalação */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyLineup}
              className="rp-btn-secondary flex min-h-[48px] items-center justify-center gap-1.5 rounded-[16px] px-3 text-xs font-bold"
            >
              <ClipboardCopy className="h-4 w-4 text-[#BEF264]" />
              Copiar escalação
            </button>
            <button
              type="button"
              onClick={onGoToMatch}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-[16px] border border-[#BEF264]/35 bg-[#84CC16]/12 px-3 text-xs font-extrabold text-[#D9F99D] transition hover:bg-[#84CC16]/20"
            >
              <Play className="h-4 w-4 fill-current" />
              Ir para Ao vivo
            </button>
          </div>

          {!readOnly && (
            <div className="rp-surface space-y-3 rounded-[24px] p-4">
              <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#879287]">
                <Clock className="h-3.5 w-3.5 text-[#BEF264]" />
                Chegou atrasado
              </h3>

              {lateArrivals.length > 0 && (
                <div className="space-y-2">
                  {lateArrivals.map((p) => (
                    <div key={p.id} className="rp-well space-y-2 rounded-2xl p-3">
                      <p className="truncate text-sm font-bold text-[#F4F7F2]">
                        {p.name}
                        {p.isGoalkeeper && (
                          <span className="ml-1.5 font-mono text-[11px] font-extrabold text-[#FDE68A]">
                            GK
                          </span>
                        )}
                        <span className="ml-2 font-mono text-[10px] uppercase text-[#879287]">
                          sem time
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => lastTeam && addLateToTeam(p.id, lastTeam.id)}
                          className="rp-btn-primary min-h-[42px] truncate rounded-xl px-2 text-xs"
                        >
                          Último da fila
                        </button>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) addLateToTeam(p.id, e.target.value);
                          }}
                          className="rp-input min-h-[42px] rounded-xl px-2 text-xs font-bold"
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
                <p className="text-xs text-[#879287]">
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
                    className="rp-input min-w-0 flex-1 rounded-xl px-3.5 text-sm"
                  />
                  <select
                    value={lateTeamId || lastTeam?.id || ''}
                    onChange={(e) => setLateTeamId(e.target.value)}
                    className="rp-input w-[38%] rounded-xl px-2 text-xs font-bold"
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
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#BEF264]/30 bg-[#84CC16]/10 text-xs font-extrabold text-[#D9F99D] transition hover:bg-[#84CC16]/20 disabled:opacity-40"
                >
                  <UserPlus className="h-4 w-4" /> Adicionar ao time
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
