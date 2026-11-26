import React, { useState } from 'react';
import {
  Flag,
  ListOrdered,
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
import { safeHexColor } from '../../utils/color';
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

/** Gradiente e texto de alto contraste para o botão "+ Gol" de acordo com o colete. */
function goalButtonStyle(hex: string): React.CSSProperties {
  const normalized = safeHexColor(hex).toLowerCase();
  const map: Record<string, { bg: string; color: string }> = {
    '#34d399': { bg: 'linear-gradient(135deg, #D9F99D, #A3E635)', color: '#10160A' },
    '#10b981': { bg: 'linear-gradient(135deg, #D9F99D, #A3E635)', color: '#10160A' },
    '#fbbf24': { bg: 'linear-gradient(135deg, #FEF08A, #FBBF24)', color: '#1A1405' },
    '#f59e0b': { bg: 'linear-gradient(135deg, #FEF08A, #FBBF24)', color: '#1A1405' },
    '#60a5fa': { bg: 'linear-gradient(135deg, #BFDBFE, #60A5FA)', color: '#0A1628' },
    '#3b82f6': { bg: 'linear-gradient(135deg, #BFDBFE, #60A5FA)', color: '#0A1628' },
    '#f87171': { bg: 'linear-gradient(135deg, #FECACA, #F87171)', color: '#260808' },
    '#ef4444': { bg: 'linear-gradient(135deg, #FECACA, #F87171)', color: '#260808' },
    '#c084fc': { bg: 'linear-gradient(135deg, #E9D5FF, #C084FC)', color: '#1C0A29' },
    '#a855f7': { bg: 'linear-gradient(135deg, #E9D5FF, #C084FC)', color: '#1C0A29' },
    '#e4e4e7': { bg: 'linear-gradient(135deg, #F1F5F9, #CBD5E1)', color: '#0D1510' },
  };
  const preset = map[normalized];
  if (preset) {
    return { backgroundImage: preset.bg, color: preset.color };
  }
  return { backgroundColor: normalized, color: '#0D1510' };
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
      <div className="rp-card mx-auto max-w-xl rounded-[28px] p-10 text-center">
        <p className="rp-eyebrow mb-2">QUADRA LIVRE</p>
        <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-[#0D1510]">
          Aguardando escalação
        </h2>
        <p className="mt-2 text-sm font-medium text-[#647468]">
          {readOnly
            ? 'Nenhuma partida em andamento ainda.'
            : 'Sorteie os times para começar o placar ao vivo.'}
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={onGoToSort}
            className="rp-btn-primary mt-6 min-h-[48px] rounded-2xl px-6 text-sm"
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
  const waitingTeams = teams.filter((t) => t.id !== teamA.id && t.id !== teamB.id);

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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      {/* Palco Principal — Placar + Controles */}
      <div className="space-y-5 lg:col-span-8">
        {/* Cabeçalho da Partida */}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="rp-eyebrow mb-1.5 flex items-center gap-2">
              {activeMatch.isRunning && (
                <span className="sync-dot-wrap text-emerald-600">
                  <span className="sync-dot-pulse" />
                  <span className="sync-dot" />
                </span>
              )}
              <span>
                PARTIDA {matchNumber} · {statusTag}
                {readOnly ? ' · LEITURA' : ''}
              </span>
            </p>
            <h1 className="truncate text-[28px] font-extrabold leading-[1.06] tracking-[-0.055em] text-[#0D1510] sm:text-[36px]">
              {shortA} <span className="text-[#A8B8A4]">×</span> {shortB}
            </h1>
          </div>

          {!readOnly && teams.length >= 2 && (
            <button
              type="button"
              onClick={() => setShowMatchup(true)}
              className="rp-btn-secondary flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-2xl px-4 text-xs"
              title="Trocar confronto"
            >
              <Swords className="h-3.5 w-3.5 text-[#3F6212]" />
              <span>Trocar confronto</span>
            </button>
          )}
        </div>

        {/* Placar Principal */}
        <div
          className={`rp-card relative overflow-hidden rounded-[32px] px-5 pb-7 pt-5 text-center transition sm:px-8 sm:pb-8 sm:pt-6 ${
            isTimeOver
              ? 'border-[#D97706]/70 ring-4 ring-[#FEF3C7]'
              : isLastMinute
              ? 'border-[#D97706]/50'
              : ''
          }`}
        >
          {/* Faixa superior nas cores dos dois times em campo */}
          <div className="absolute inset-x-0 top-0 grid h-2 grid-cols-2 border-b border-[#0D1510]/10">
            <div style={{ backgroundColor: safeHexColor(teamA.color) }} />
            <div style={{ backgroundColor: safeHexColor(teamB.color) }} />
          </div>

          {!readOnly && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 rounded-2xl border border-[#0D1510]/[0.08] bg-[#F6F9F2] p-1">
                {[5, 7, 8, 10].map((m) => {
                  const active = durationSeconds === m * 60;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onChangeDuration(m)}
                      className={`min-h-[36px] min-w-[42px] rounded-xl px-2 font-mono text-[11px] font-extrabold transition ${
                        active
                          ? 'bg-white text-[#365314] shadow-sm ring-1 ring-[#65A30D]/30'
                          : 'text-[#647468] hover:text-[#0D1510]'
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
                className="rp-btn-secondary flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.04em]"
                title="Testar apito"
              >
                <Volume2 className="h-3.5 w-3.5 text-[#3F6212]" />
                Apito
              </button>
            </div>
          )}

          {readOnly ? (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#84CC16]/35 bg-[#ECFCCB] px-3.5 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#365314]">
              <span className="sync-dot-wrap">
                <span className="sync-dot-pulse" />
                <span className="sync-dot" />
              </span>
              Atualiza automaticamente a cada gol
            </p>
          ) : (
            <div
              className={`mb-5 inline-flex items-center justify-center rounded-[24px] border px-6 py-2.5 shadow-inner transition-colors duration-300 sm:px-8 sm:py-3 ${
                isTimeOver
                  ? 'animate-pulse border-[#D97706]/50 bg-[#FEF3C7]'
                  : isLastMinute
                  ? 'border-[#D97706]/45 bg-[#FEF3C7]'
                  : 'border-[#84CC16]/35 bg-[#F6F9F2]'
              }`}
            >
              <div
                className={`font-mono text-[48px] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-[68px] ${
                  isTimeOver || isLastMinute ? 'text-[#92400E]' : 'text-[#365314]'
                }`}
              >
                {mins}:{secs}
              </div>
            </div>
          )}

          <div className="mt-2 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
            {[
              { team: teamA, label: shortA, score: activeMatch.scoreA, gk: gkA },
              { team: teamB, label: shortB, score: activeMatch.scoreB, gk: gkB },
            ].map((side, idx) => (
              <React.Fragment key={side.team.id}>
                {idx === 1 && (
                  <span className="font-mono text-[28px] font-bold text-[#C5D1C1] sm:text-[42px]">
                    ×
                  </span>
                )}
                <div className="flex min-w-0 flex-col items-center gap-2 rounded-[24px] bg-[#F6F9F2] px-2.5 py-5 sm:px-6 sm:py-6">
                  <span className="flex max-w-full items-center gap-2 text-sm font-extrabold text-[#0D1510] sm:text-base">
                    <i
                      className="block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15"
                      style={{ backgroundColor: safeHexColor(side.team.color) }}
                    />
                    <span className="truncate">{side.label}</span>
                  </span>
                  <span
                    key={`${side.team.id}-${side.score}`}
                    className="animate-score-pop font-mono text-[56px] font-extrabold leading-none tracking-[-0.04em] text-[#0D1510] tabular-nums min-[380px]:text-[76px] sm:text-[104px]"
                  >
                    {side.score}
                  </span>
                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[#D97706]/25 bg-[#FEF3C7]/75 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-[#92400E]">
                    <Shield className="h-3 w-3 shrink-0" />
                    <span className="truncate">{side.gk ? side.gk : 'sem goleiro'}</span>
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {activeMatch.isRunning && !readOnly && (
            <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#F6F9F2] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#647468]">
              <Sun className="h-3 w-3 text-[#4D7C0F]" />
              Tela mantida acesa
            </p>
          )}
        </div>

        {/* Ações Principais */}
        {!readOnly && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { team: teamA, label: shortA },
                { team: teamB, label: shortB },
              ].map(({ team, label }) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setGoalModalTeam(team)}
                  style={goalButtonStyle(team.color)}
                  className="flex min-h-[60px] items-center justify-center gap-2 rounded-[20px] px-4 text-base font-extrabold tracking-[-0.02em] shadow-lg shadow-[#0D1510]/10 ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-xl hover:brightness-[1.03]"
                >
                  <Plus className="h-5 w-5 shrink-0 stroke-[3]" />
                  <span className="truncate">Gol {label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:col-span-7">
                <button
                  type="button"
                  onClick={onToggleTimer}
                  className={`flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-extrabold transition ${
                    activeMatch.isRunning
                      ? 'rp-btn-secondary'
                      : 'rp-btn-primary'
                  }`}
                >
                  {activeMatch.isRunning ? (
                    <>
                      <Pause className="h-4 w-4 fill-current" />
                      Pausar
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
                  className="rp-btn-secondary flex min-h-[50px] items-center justify-center rounded-[16px] px-4 font-mono text-xs font-extrabold"
                  title="Adicionar 1 minuto"
                >
                  +1m
                </button>

                <button
                  type="button"
                  onClick={onResetTimer}
                  className="rp-btn-secondary flex h-[50px] w-[50px] items-center justify-center rounded-[16px] text-[#647468] hover:text-[#0D1510]"
                  aria-label="Resetar cronômetro"
                  title="Resetar cronômetro"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowEndModal(true)}
                className="rp-btn-dark flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] px-4 text-sm sm:col-span-5"
              >
                <Flag className="h-4 w-4 text-[#BEF264]" />
                Encerrar e girar fila
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Coluna Lateral Direita — Lances ao vivo + Próximos na fila */}
      <div className="space-y-4 lg:sticky lg:top-8 lg:col-span-4">
        {/* Lances da Partida */}
        <div className="rp-card rp-stagger space-y-3 rounded-[26px] p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#3F6212]">
              Lances da partida
            </h3>
            <span className="rounded-lg bg-[#F6F9F2] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#647468] tabular-nums">
              {activeMatch.events.length} {activeMatch.events.length === 1 ? 'gol' : 'gols'}
            </span>
          </div>

          {activeMatch.events.length === 0 ? (
            <p className="rp-well rounded-2xl px-4 py-6 text-center text-xs font-medium text-[#647468]">
              Nenhum gol registrado nesta partida ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {activeMatch.events.map((ev) => {
                const evTeam = teams.find((t) => t.id === ev.teamId);
                const isOwnGoal = ev.scorerId === 'own_goal';
                const scorerName = isOwnGoal
                  ? 'Gol contra'
                  : playerMap.get(ev.scorerId) || 'Jogador';
                const assistName = ev.assistId ? playerMap.get(ev.assistId) : null;

                return (
                  <div
                    key={ev.id}
                    className="rp-well flex items-center justify-between gap-2 rounded-[16px] px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15"
                        style={{ backgroundColor: safeHexColor(evTeam?.color ?? '#84cc16') }}
                      />
                      <div className="min-w-0 text-[13px] font-bold leading-snug text-[#0D1510]">
                        <span className={isOwnGoal ? 'text-[#DC2626]' : 'text-[#3F6212]'}>
                          {isOwnGoal ? 'Contra' : 'Gol'}
                        </span>
                        <span className="mx-1.5 text-[#C5D1C1]">·</span>
                        <span>{scorerName}</span>
                        {assistName && (
                          <span className="block text-[11px] font-semibold text-[#647468]">
                            assist. {assistName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="font-mono text-xs font-bold text-[#647468] tabular-nums">
                        {ev.minuteFormatted}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveEvent(ev.id);
                            toast.show('Gol removido', 'info');
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#647468] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                          aria-label="Remover gol"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fila de Espera */}
        {waitingTeams.length > 0 && (
          <div
            className="rp-card rp-stagger space-y-3 rounded-[26px] p-5"
            style={{ '--stagger': 1 } as React.CSSProperties}
          >
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#647468]">
              <ListOrdered className="h-3.5 w-3.5 text-[#3F6212]" />
              Próximos na fila ({waitingTeams.length})
            </h3>
            <div className="space-y-2">
              {waitingTeams.map((t, idx) => (
                <div
                  key={t.id}
                  className="rp-well flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="font-mono text-[11px] font-extrabold text-[#3F6212]">
                      #{idx + 1}
                    </span>
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15"
                      style={{ backgroundColor: safeHexColor(t.color) }}
                    />
                    <span className="truncate text-sm font-bold text-[#0D1510]">{t.name}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-[#647468] tabular-nums">
                    {t.playerIds.length} jog.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
