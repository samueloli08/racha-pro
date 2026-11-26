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
import { safeHexColor } from '../../utils/color';
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
      <h3 className="truncate text-[17px] font-extrabold tracking-[-0.03em] text-[#0D1510] group-hover:text-[#3F6212]">
        {team.name}
      </h3>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-[#8A998D] group-hover:text-[#3F6212]" />
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
    const cleaned = lateName.trim().slice(0, 60);
    if (!target || !cleaned) return;
    const newId = onAddPlayer(cleaned, false, 3);
    if (!newId) return;
    onAddPlayerToTeam(newId, target.id);
    toast.show(`${cleaned} entrou no ${target.name}`);
    setLateName('');
  };

  const configExpanded = teams.length === 0 || showConfig;

  return (
    <div className="space-y-5">
      {/* Barra superior de comando (ampla no desktop, enxuta no mobile) */}
      {!readOnly && (
        <div className="rp-card space-y-4 rounded-[26px] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onRunSort();
                  setSelectedSwap(null);
                  setShowConfig(false);
                  toast.show('Times sorteados!');
                }}
                disabled={presentCount < 2}
                className="rp-btn-primary flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-[16px] px-5 text-sm sm:flex-none disabled:opacity-40"
              >
                <Shuffle className="h-4 w-4 stroke-[2.5]" />
                {teams.length > 0
                  ? 'Sortear de novo'
                  : `Sortear times (${presentCount} presentes)`}
              </button>

              {teams.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyLineup}
                    className="rp-btn-secondary hidden min-h-[50px] items-center justify-center gap-1.5 rounded-[16px] px-4 text-xs sm:inline-flex"
                  >
                    <ClipboardCopy className="h-4 w-4 text-[#3F6212]" />
                    Copiar escalação
                  </button>
                  <button
                    type="button"
                    onClick={onGoToMatch}
                    className="rp-btn-dark hidden min-h-[50px] items-center justify-center gap-1.5 rounded-[16px] px-4 text-xs sm:inline-flex"
                  >
                    <Play className="h-3.5 w-3.5 fill-current text-[#BEF264]" />
                    Ir para Ao vivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfig((v) => !v)}
                    aria-label="Configurar sorteio"
                    title="Configurar formato e critério"
                    className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[16px] border transition lg:hidden ${
                      showConfig
                        ? 'border-[#65A30D]/45 bg-[#ECFCCB] text-[#365314]'
                        : 'border-[#0D1510]/[0.12] bg-[#F6F9F2] text-[#46544A]'
                    }`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Controles rápidos inline no desktop */}
            <div className="hidden items-center gap-3 lg:flex">
              <div className="flex items-center gap-1 rounded-2xl border border-[#0D1510]/[0.08] bg-[#F6F9F2] p-1">
                {[4, 5, 6, 7, 8].map((num) => {
                  const active = playersPerTeam === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => onUpdateSettings(num, sortMode)}
                      className={`min-h-[38px] rounded-xl px-2.5 font-mono text-xs font-extrabold transition ${
                        active
                          ? 'bg-white text-[#365314] shadow-sm ring-1 ring-[#65A30D]/30'
                          : 'text-[#647468] hover:text-[#0D1510]'
                      }`}
                    >
                      {num}x{num}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 rounded-2xl border border-[#0D1510]/[0.08] bg-[#F6F9F2] p-1">
                <button
                  type="button"
                  onClick={() => onUpdateSettings(playersPerTeam, 'balanced')}
                  className={`flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${
                    sortMode === 'balanced'
                      ? 'bg-white text-[#365314] shadow-sm ring-1 ring-[#65A30D]/30'
                      : 'text-[#647468] hover:text-[#0D1510]'
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" />
                  Equilibrado
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings(playersPerTeam, 'random')}
                  className={`flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${
                    sortMode === 'random'
                      ? 'bg-white text-[#365314] shadow-sm ring-1 ring-[#65A30D]/30'
                      : 'text-[#647468] hover:text-[#0D1510]'
                  }`}
                >
                  <Dices className="h-3.5 w-3.5" />
                  Aleatório
                </button>
              </div>
            </div>
          </div>

          {/* Configuração expandida em mobile/tablet */}
          {configExpanded && (
            <div className="space-y-3 border-t border-[#0D1510]/[0.08] pt-3.5 lg:hidden">
              <div>
                <p className="mb-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                  Jogadores por time
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[4, 5, 6, 7, 8].map((num) => {
                    const active = playersPerTeam === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onUpdateSettings(num, sortMode)}
                        className={`min-h-[42px] rounded-xl border font-mono text-xs font-extrabold transition ${
                          active
                            ? 'border-[#65A30D]/45 bg-[#ECFCCB] text-[#365314]'
                            : 'border-[#0D1510]/10 bg-[#F6F9F2] text-[#647468]'
                        }`}
                      >
                        {num}x{num}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                  Critério do sorteio
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings(playersPerTeam, 'balanced')}
                    className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition ${
                      sortMode === 'balanced'
                        ? 'border-[#65A30D]/45 bg-[#ECFCCB] text-[#365314]'
                        : 'border-[#0D1510]/10 bg-[#F6F9F2] text-[#647468]'
                    }`}
                  >
                    <Scale className="h-3.5 w-3.5 shrink-0" />
                    Equilibrado
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings(playersPerTeam, 'random')}
                    className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition ${
                      sortMode === 'random'
                        ? 'border-[#65A30D]/45 bg-[#ECFCCB] text-[#365314]'
                        : 'border-[#0D1510]/10 bg-[#F6F9F2] text-[#647468]'
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
        <div className="rp-card rounded-[26px] p-10 text-center">
          <p className="text-sm font-medium text-[#647468]">
            Os times ainda não foram sorteados pelo organizador.
          </p>
        </div>
      )}

      {teams.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Coluna principal de times */}
          <div className={`space-y-4 ${readOnly ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
            {!readOnly &&
              (selectedSwap ? (
                <div className="sticky top-[70px] z-20 flex items-center justify-between gap-3 rounded-2xl border border-[#D97706]/50 bg-[#FFFBEB]/95 p-3 pl-4 shadow-xl shadow-[#D97706]/15 backdrop-blur-xl lg:top-4">
                  <p className="min-w-0 text-xs text-[#92400E]">
                    <span className="font-extrabold">Trocando:</span>{' '}
                    <span className="font-extrabold text-[#0D1510]">
                      {selectedPlayer?.name ?? 'Jogador'}
                    </span>
                    <span className="block text-[11px] text-[#78350F]">
                      Toque em outro jogador para trocar de time
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedSwap(null)}
                    className="flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl bg-[#B45309] px-3 text-xs font-extrabold text-white"
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#647468]">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-[#3F6212]" />
                  Clique em dois jogadores para trocar manualmente entre times
                </p>
              ))}

            <div
              className={`grid grid-cols-1 gap-4 ${
                readOnly ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'
              }`}
            >
              {teams.map((team, idx) => {
                const teamPlayers = team.playerIds
                  .map((id) => playerMap.get(id))
                  .filter((p): p is Player => Boolean(p));

                const totalSkill = teamPlayers.reduce((acc, p) => acc + p.skill, 0);
                const isOnPitch = idx === 0 || idx === 1;

                return (
                  <div
                    key={team.id}
                    style={{ '--stagger': idx } as React.CSSProperties}
                    className="rp-card rp-card-interactive rp-stagger relative overflow-hidden rounded-[26px] p-5"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-2 border-b border-[#0D1510]/10"
                      style={{ backgroundColor: safeHexColor(team.color) }}
                    />

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {readOnly ? (
                          <>
                            <span
                              className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/15"
                              style={{ backgroundColor: safeHexColor(team.color) }}
                            />
                            <h3 className="truncate text-[17px] font-extrabold tracking-[-0.03em] text-[#0D1510]">
                              {team.name}
                            </h3>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setColorPickerTeamId(
                                  colorPickerTeamId === team.id ? null : team.id
                                )
                              }
                              className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-[#F6F9F2]"
                              aria-label={`Trocar cor do ${team.name}`}
                              title="Trocar cor do colete"
                            >
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-black/15"
                                style={{ backgroundColor: safeHexColor(team.color) }}
                              >
                                <Palette className="h-2.5 w-2.5 text-[#0D1510]/80" />
                              </span>
                            </button>
                            <TeamName
                              team={team}
                              onRename={(name) => onRenameTeam(team.id, name)}
                            />
                          </>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-[11px] font-extrabold tracking-[0.04em] text-[#647468] tabular-nums">
                          ★ {totalSkill} · {teamPlayers.length} JOG.
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] ${
                            isOnPitch
                              ? 'bg-[#ECFCCB] text-[#365314]'
                              : 'bg-[#F6F9F2] text-[#647468]'
                          }`}
                        >
                          {idx === 0
                            ? 'Em campo A'
                            : idx === 1
                            ? 'Em campo B'
                            : `Próximo #${idx - 1}`}
                        </span>
                      </div>
                    </div>

                    {!readOnly && colorPickerTeamId === team.id && (
                      <div className="mt-3 grid grid-cols-6 gap-2">
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
                              className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-black/15"
                              style={{ backgroundColor: preset.color }}
                            >
                              {team.color.toLowerCase() === preset.color && (
                                <Check className="h-3.5 w-3.5 text-[#0D1510] stroke-[3]" />
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-3.5 flex flex-wrap gap-2">
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
                                  ? 'border-[#D97706]/35 bg-[#FEF3C7]/85 text-[#92400E]'
                                  : 'border-[#0D1510]/10 bg-[#F6F9F2] text-[#0D1510]'
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
                            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border px-3 text-[13px] font-bold transition ${
                              isSelected
                                ? 'animate-swap-pulse border-[#D97706] bg-[#FEF3C7] text-[#92400E] shadow-md'
                                : selectedSwap
                                ? 'border-[#0D1510]/20 bg-white text-[#0D1510] hover:border-[#D97706]'
                                : p.isGoalkeeper
                                ? 'border-[#D97706]/35 bg-[#FEF3C7]/80 text-[#92400E] hover:border-[#D97706]'
                                : 'border-[#0D1510]/10 bg-[#F6F9F2] text-[#0D1510] hover:border-[#84CC16] hover:bg-[#ECFCCB]/60'
                            }`}
                          >
                            <span>{label}</span>
                            {isSelected && <ArrowLeftRight className="h-3.5 w-3.5 text-[#B45309]" />}
                          </button>
                        );
                      })}
                      {teamPlayers.length === 0 && (
                        <p className="py-1 text-xs text-[#647468]">Time vazio.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ações da Escalação (mobile / readOnly) */}
            <div className={`grid grid-cols-2 gap-2.5 pt-1 ${!readOnly ? 'sm:hidden' : 'max-w-md'}`}>
              <button
                type="button"
                onClick={handleCopyLineup}
                className="rp-btn-secondary flex min-h-[48px] items-center justify-center gap-1.5 rounded-[16px] px-3 text-xs font-bold"
              >
                <ClipboardCopy className="h-4 w-4 text-[#3F6212]" />
                Copiar escalação
              </button>
              <button
                type="button"
                onClick={onGoToMatch}
                className="rp-btn-dark flex min-h-[48px] items-center justify-center gap-1.5 rounded-[16px] px-3 text-xs"
              >
                <Play className="h-3.5 w-3.5 fill-current text-[#BEF264]" />
                Ir para Ao vivo
              </button>
            </div>
          </div>

          {/* Coluna lateral direita no desktop: Chegou atrasado */}
          {!readOnly && (
            <div className="lg:sticky lg:top-8 lg:col-span-4">
              <div className="rp-card rp-stagger space-y-3.5 rounded-[26px] p-5">
                <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#3F6212]">
                  <Clock className="h-3.5 w-3.5" />
                  Chegou atrasado
                </h3>

                {lateArrivals.length > 0 && (
                  <div className="space-y-2.5">
                    {lateArrivals.map((p) => (
                      <div key={p.id} className="rp-well space-y-2 rounded-2xl p-3">
                        <p className="truncate text-sm font-extrabold text-[#0D1510]">
                          {p.name}
                          {p.isGoalkeeper && (
                            <span className="ml-1.5 rounded bg-[#FEF3C7] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#92400E]">
                              GOL
                            </span>
                          )}
                          <span className="ml-2 font-mono text-[10px] uppercase text-[#647468]">
                            sem time
                          </span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => lastTeam && addLateToTeam(p.id, lastTeam.id)}
                            className="rp-btn-primary min-h-[40px] truncate rounded-xl px-2 text-xs"
                          >
                            Último da fila
                          </button>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) addLateToTeam(p.id, e.target.value);
                            }}
                            className="rp-input min-h-[40px] rounded-xl px-2 text-xs font-bold"
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

                <form onSubmit={handleNewLate} className="space-y-2.5">
                  <p className="text-xs leading-relaxed text-[#647468]">
                    {lateArrivals.length === 0
                      ? 'Todos os presentes já estão em um time. Chegou mais alguém?'
                      : 'Ou cadastre alguém novo direto em um time:'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={lateName}
                      onChange={(e) => setLateName(e.target.value)}
                      maxLength={60}
                      placeholder="Nome do jogador..."
                      className="rp-input min-w-0 flex-1 rounded-xl px-3.5 text-sm font-medium"
                    />
                    <select
                      value={lateTeamId || lastTeam?.id || ''}
                      onChange={(e) => setLateTeamId(e.target.value)}
                      className="rp-input w-[40%] rounded-xl px-2 text-xs font-bold"
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
                    className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#65A30D]/40 bg-[#ECFCCB] text-xs font-extrabold text-[#365314] transition hover:bg-[#D9F99D] disabled:opacity-40"
                  >
                    <UserPlus className="h-4 w-4" /> Adicionar ao time
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
