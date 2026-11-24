import React, { useState } from 'react';
import {
  Flag,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sun,
  Swords,
  Trash2,
  Volume2,
} from 'lucide-react';
import { ActiveMatchState, Player, RotationRule, Team } from '../../types/racha';
import { playRefWhistle, unlockAudio } from '../../utils/sound';
import { useToast } from '../ui/Toast';
import { EndMatchModal } from './EndMatchModal';
import { GoalModal } from './GoalModal';
import { MatchupModal } from './MatchupModal';

interface MatchTabProps {
  activeMatch: ActiveMatchState;
  teams: Team[];
  players: Player[];
  durationSeconds: number;
  matchNumber?: number;
  readOnly?: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onAddOneMinute: () => void;
  onChangeDuration: (minutes: number) => void;
  onSetMatchup: (teamAId: string, teamBId: string) => void;
  onRegisterGoal: (
    teamId: string,
    scorerId: string | 'own_goal',
    assistId: string | null
  ) => void;
  onRemoveEvent: (eventId: string) => void;
  onFinishMatch: (rule: RotationRule) => void;
  onGoToSort: () => void;
}

/** Retira prefixo "Time " apenas para nomes curtos de placar/botão quando fizer sentido. */
function shortTeamLabel(name: string): string {
  const cleaned = name.replace(/^Time\s+/i, '').trim();
  return cleaned.length > 0 ? cleaned : name;
}

const SAFE_HEX_RE = /^#[0-9a-f]{6}$/i;

function safeHexColor(hex: string): string {
  return SAFE_HEX_RE.test(hex) ? hex : '#34d399';
}

/** Gradiente e texto de alto contraste para o botão "+ Gol" de acordo com o colete. */
function goalButtonStyle(hex: string): React.CSSProperties {
  const normalized = safeHexColor(hex).toLowerCase();
  const map: Record<string, { bg: string; color: string }> = {
    '#34d399': { bg: 'linear-gradient(135deg, #D9F99D, #A3E635)', color: '#11180B' },
    '#10b981': { bg: 'linear-gradient(135deg, #D9F99D, #A3E635)', color: '#11180B' },
    '#fbbf24': { bg: 'linear-gradient(135deg, #FDE68A, #FBBF24)', color: '#1A1405' },
    '#f59e0b': { bg: 'linear-gradient(135deg, #FDE68A, #FBBF24)', color: '#1A1405' },
    '#60a5fa': { bg: 'linear-gradient(135deg, #BFDBFE, #60A5FA)', color: '#0A1628' },
    '#3b82f6': { bg: 'linear-gradient(135deg, #BFDBFE, #60A5FA)', color: '#0A1628' },
    '#f87171': { bg: 'linear-gradient(135deg, #FECACA, #F87171)', color: '#260808' },
    '#ef4444': { bg: 'linear-gradient(135deg, #FECACA, #F87171)', color: '#260808' },
    '#c084fc': { bg: 'linear-gradient(135deg, #E9D5FF, #C084FC)', color: '#1C0A29' },
    '#a855f7': { bg: 'linear-gradient(135deg, #E9D5FF, #C084FC)', color: '#1C0A29' },
    '#e4e4e7': { bg: 'linear-gradient(135deg, #F8FAFC, #E4E4E7)', color: '#0B100D' },
  };
  const preset = map[normalized];
  if (preset) {
    return { backgroundImage: preset.bg, color: preset.color };
  }
  return { backgroundColor: normalized, color: '#0B100D' };
}

export const MatchTab: React.FC<MatchTabProps> = ({
  activeMatch,
  teams,
  players,
  durationSeconds,
  matchNumber = 1,
  readOnly = false,
  onToggleTimer,
  onResetTimer,
  onAddOneMinute,
  onChangeDuration,
  onSetMatchup,
  onRegisterGoal,
  onRemoveEvent,
  onFinishMatch,
  onGoToSort,
}) => {
  const toast = useToast();
  const [goalModalTeam, setGoalModalTeam] = useState<Team | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showMatchup, setShowMatchup] = useState(false);

  const teamA = teams.find((t) => t.id === activeMatch.teamAId);
  const teamB = teams.find((t) => t.id === activeMatch.teamBId);
  const playerMap = new Map(players.map((p) => [p.id, p.name]));

  if (!teamA || !teamB) {
    return (
      <div className="rp-card rounded-[28px] p-8 text-center">
        <p className="rp-eyebrow mb-2">QUADRA LIVRE</p>
        <p className="text-sm font-medium text-[#879287]">
          {readOnly
            ? 'Nenhuma partida em andamento ainda.'
            : 'Sorteie os times para começar o placar ao vivo.'}
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={onGoToSort}
            className="rp-btn-primary mt-5 min-h-[48px] rounded-2xl px-6 text-sm"
          >
            Ir para Times
          </button>
        )}
      </div>
    );
  }

  const mins = Math.floor(activeMatch.secondsRemaining / 60)
    .toString()
    .padStart(2, '0');
  const secs = (activeMatch.secondsRemaining % 60).toString().padStart(2, '0');
  const isTimeOver = activeMatch.secondsRemaining === 0;
  const isLastMinute =
    activeMatch.isRunning && activeMatch.secondsRemaining <= 60 && activeMatch.secondsRemaining > 0;

  const shortA = shortTeamLabel(teamA.name);
  const shortB = shortTeamLabel(teamB.name);

  const goalkeeperName = (team: Team): string | null => {
    const gk = players.find((p) => p.isGoalkeeper && team.playerIds.includes(p.id));
    return gk ? gk.name : null;
  };

  const gkA = goalkeeperName(teamA);
  const gkB = goalkeeperName(teamB);

  const handleChangeMatchup = (aId: string, bId: string) => {
    if (activeMatch.events.length > 0) {
      const ok = window.confirm(
        'Trocar o confronto vai zerar o placar e os gols desta partida. Continuar?'
      );
      if (!ok) return;
    }
    onSetMatchup(aId, bId);
    setShowMatchup(false);
    toast.show('Confronto atualizado');
  };

  const statusTag = isTimeOver
    ? 'TEMPO ENCERRADO'
    : activeMatch.isRunning
    ? 'EM ANDAMENTO'
    : 'PRONTA PRA ROLAR';

  return (
    <div className="space-y-4">
      {/* Cabeçalho da Partida */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="rp-eyebrow mb-1.5">
            PARTIDA {matchNumber} · {statusTag}
            {readOnly ? ' · LEITURA' : ''}
          </p>
          <h2 className="truncate text-[28px] font-extrabold leading-[1.08] tracking-[-0.065em] text-[#F7FAEF] sm:text-[32px]">
            {shortA} <span className="text-[#4B554C]">x</span> {shortB}
          </h2>
        </div>

        {!readOnly && teams.length >= 2 && (
          <button
            type="button"
            onClick={() => setShowMatchup(true)}
            className="rp-btn-secondary flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-2xl px-3 text-xs"
            title="Trocar confronto"
          >
            <Swords className="h-3.5 w-3.5 text-[#BEF264]" />
            <span>Trocar</span>
          </button>
        )}
      </div>

      {/* Placar Principal */}
      <div
        className={`rp-card rounded-[28px] px-4 pb-5 pt-4 text-center transition sm:px-6 ${
          isTimeOver
            ? 'animate-pulse border-[#FBBF24]/70'
            : isLastMinute
            ? 'border-[#FBBF24]/45'
            : ''
        }`}
      >
        {!readOnly && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {[5, 7, 8, 10].map((m) => {
                const active = durationSeconds === m * 60;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChangeDuration(m)}
                    className={`min-h-[38px] min-w-[40px] rounded-xl px-2 font-mono text-[11px] font-extrabold transition ${
                      active
                        ? 'border border-[#BEF264]/40 bg-[#84CC16]/15 text-[#D9F99D]'
                        : 'border border-white/[0.06] bg-[#0B100D] text-[#879287] hover:text-[#C9D3C4]'
                    }`}
                  >
                    {m}m
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                unlockAudio();
                playRefWhistle();
              }}
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/[0.085] bg-[#0B100D] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-[#C9D3C4] hover:border-[#BEF264]/35 hover:text-[#D9F99D]"
              title="Testar apito"
            >
              <Volume2 className="h-3.5 w-3.5 text-[#BEF264]" />
              Apito
            </button>
          </div>
        )}

        {readOnly ? (
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#879287]">
            Atualiza automaticamente a cada gol
          </p>
        ) : (
          <div
            className={`font-mono text-[56px] font-extrabold leading-none tracking-[-0.02em] tabular-nums sm:text-[64px] ${
              isTimeOver || isLastMinute ? 'text-[#FBBF24]' : 'text-[#BEF264]'
            }`}
          >
            {mins}:{secs}
          </div>
        )}

        <div className="mt-4 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          {[
            { team: teamA, label: shortA, score: activeMatch.scoreA, gk: gkA },
            { team: teamB, label: shortB, score: activeMatch.scoreB, gk: gkB },
          ].map((side, idx) => (
            <React.Fragment key={side.team.id}>
              {idx === 1 && (
                <span className="font-mono text-[28px] font-bold text-[#4B554C]">×</span>
              )}
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                <span className="flex max-w-full items-center gap-2 text-[13px] font-extrabold text-[#C9D3C4]">
                  <i
                    className="block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: side.team.color }}
                  />
                  <span className="truncate">{side.label}</span>
                </span>
                <span className="font-mono text-[76px] font-extrabold leading-none tracking-[-0.03em] text-[#F4F7F2] tabular-nums sm:text-[84px]">
                  {side.score}
                </span>
                <span className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[10px] font-bold text-[#879287]">
                  <Shield className="h-3 w-3 shrink-0 text-[#FBBF24]/80" />
                  <span className="truncate">{side.gk ? side.gk : 'sem goleiro'}</span>
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {activeMatch.isRunning && !readOnly && (
          <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#879287]">
            <Sun className="h-3 w-3 text-[#BEF264]" />
            Tela mantida acesa
          </p>
        )}
      </div>

      {/* Ações Principais */}
      {!readOnly && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { team: teamA, label: shortA },
              { team: teamB, label: shortB },
            ].map(({ team, label }) => (
              <button
                key={team.id}
                type="button"
                onClick={() => setGoalModalTeam(team)}
                style={goalButtonStyle(team.color)}
                className="flex min-h-[56px] items-center justify-center gap-1.5 rounded-[18px] px-3 text-[15px] font-extrabold tracking-[-0.02em] shadow-lg shadow-black/25 transition hover:brightness-105"
              >
                <Plus className="h-4 w-4 shrink-0 stroke-[3]" />
                <span className="truncate">Gol {label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
            <button
              type="button"
              onClick={onToggleTimer}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-bold transition ${
                activeMatch.isRunning
                  ? 'rp-btn-secondary'
                  : 'border border-[#BEF264]/35 bg-[#84CC16]/12 text-[#D9F99D] hover:bg-[#84CC16]/20'
              }`}
            >
              {activeMatch.isRunning ? (
                <>
                  <Pause className="h-4 w-4 fill-current" />
                  Pausar cronômetro
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Iniciar cronômetro
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onAddOneMinute}
              className="rp-btn-secondary flex min-h-[48px] items-center justify-center rounded-[16px] px-3.5 font-mono text-xs font-extrabold"
              title="Adicionar 1 minuto"
            >
              +1m
            </button>

            <button
              type="button"
              onClick={onResetTimer}
              className="rp-btn-secondary flex h-[48px] w-[48px] items-center justify-center rounded-[16px] text-[#879287] hover:text-[#F4F7F2]"
              aria-label="Resetar cronômetro"
              title="Resetar cronômetro"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lances da Partida */}
      {activeMatch.events.length > 0 && (
        <div className="space-y-2 pt-1">
          <h3 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#879287]">
            Lances
          </h3>
          <div className="space-y-2">
            {activeMatch.events.map((ev) => {
              const evTeam = teams.find((t) => t.id === ev.teamId);
              const isOwnGoal = ev.scorerId === 'own_goal';
              const scorerName = isOwnGoal ? 'Gol contra' : playerMap.get(ev.scorerId) || 'Jogador';
              const assistName = ev.assistId ? playerMap.get(ev.assistId) : null;

              return (
                <div
                  key={ev.id}
                  className="rp-surface flex items-center justify-between gap-2 rounded-[16px] px-3.5 py-2.5"
                >
                  <div className="min-w-0 text-[13px] font-bold leading-snug text-[#F4F7F2]">
                    <span style={{ color: evTeam?.color ?? '#BEF264' }}>
                      {isOwnGoal ? 'Contra' : 'Gol'}
                    </span>
                    <span className="mx-1.5 text-[#4B554C]">·</span>
                    <span>{scorerName}</span>
                    {assistName && (
                      <span className="ml-1.5 font-medium text-[#879287]">
                        assist. {assistName}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-mono text-xs font-bold text-[#879287] tabular-nums">
                      {ev.minuteFormatted}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveEvent(ev.id);
                          toast.show('Gol removido', 'info');
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-[#879287] hover:bg-white/[0.04] hover:text-[#F87171]"
                        aria-label="Remover gol"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Encerrar Partida */}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setShowEndModal(true)}
          className="rp-btn-secondary flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] text-sm font-extrabold"
        >
          <Flag className="h-4 w-4 text-[#BEF264]" />
          Encerrar partida e girar fila
        </button>
      )}

      {!readOnly && goalModalTeam && (
        <GoalModal
          team={goalModalTeam}
          players={players}
          onConfirm={(scorerId, assistId) => {
            onRegisterGoal(goalModalTeam.id, scorerId, assistId);
            toast.show(`Gol do ${goalModalTeam.name}!`);
            setGoalModalTeam(null);
          }}
          onClose={() => setGoalModalTeam(null)}
        />
      )}

      {!readOnly && showEndModal && (
        <EndMatchModal
          teamA={teamA}
          teamB={teamB}
          scoreA={activeMatch.scoreA}
          scoreB={activeMatch.scoreB}
          teamsCount={teams.length}
          onConfirm={(rule) => {
            onFinishMatch(rule);
            setShowEndModal(false);
            toast.show('Partida encerrada e salva no histórico');
          }}
          onClose={() => setShowEndModal(false)}
        />
      )}

      {!readOnly && showMatchup && (
        <MatchupModal
          teams={teams}
          currentAId={teamA.id}
          currentBId={teamB.id}
          onConfirm={handleChangeMatchup}
          onClose={() => setShowMatchup(false)}
        />
      )}
    </div>
  );
};
