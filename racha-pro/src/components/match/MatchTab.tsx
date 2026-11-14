import React, { useState } from 'react';
import {
  Flag,
  Pause,
  Play,
  Plus,
  RotateCcw,
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

export const MatchTab: React.FC<MatchTabProps> = ({
  activeMatch,
  teams,
  players,
  durationSeconds,
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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-sm text-zinc-400">Nenhum time sorteado ainda para iniciar a partida.</p>
        <button
          onClick={onGoToSort}
          className="mt-4 min-h-[48px] rounded-xl bg-emerald-500 px-5 text-sm font-extrabold text-zinc-950"
        >
          Ir para Sorteio
        </button>
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

  const goalkeeperName = (team: Team): string | null => {
    const gk = players.find((p) => p.isGoalkeeper && team.playerIds.includes(p.id));
    return gk ? gk.name : null;
  };

  const handleChangeMatchup = (aId: string, bId: string) => {
    if (activeMatch.events.length > 0) {
      const ok = window.confirm('Trocar o confronto vai zerar o placar e os gols desta partida. Continuar?');
      if (!ok) return;
    }
    onSetMatchup(aId, bId);
    setShowMatchup(false);
    toast.show('Confronto atualizado');
  };

  return (
    <div className="space-y-5">
      <div
        className={`rounded-3xl border p-5 text-center transition ${
          isTimeOver
            ? 'animate-pulse border-amber-500 bg-amber-500/15'
            : isLastMinute
            ? 'border-amber-500/60 bg-zinc-900'
            : 'border-zinc-800 bg-zinc-900'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-1">
            {[5, 7, 8, 10].map((m) => (
              <button
                key={m}
                onClick={() => onChangeDuration(m)}
                className={`min-h-[44px] min-w-[44px] rounded-xl px-2 text-xs font-bold ${
                  durationSeconds === m * 60
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-950 text-zinc-400'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              unlockAudio();
              playRefWhistle();
            }}
            className="flex min-h-[44px] items-center gap-1 rounded-xl bg-zinc-800 px-3 text-xs font-semibold text-zinc-300"
            title="Testar Apito"
          >
            <Volume2 className="h-4 w-4 text-emerald-400" /> Apito
          </button>
        </div>

        <div
          className={`my-2 font-mono text-6xl font-black tracking-tight tabular-nums ${
            isLastMinute ? 'text-amber-300' : 'text-white'
          }`}
        >
          {mins}:{secs}
        </div>
        {activeMatch.isRunning && (
          <p className="text-[11px] font-medium text-zinc-500">🔆 Tela mantida acesa durante o jogo</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={onToggleTimer}
            className={`col-span-2 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl text-base font-extrabold transition active:scale-95 ${
              activeMatch.isRunning ? 'bg-amber-500 text-zinc-950' : 'bg-emerald-500 text-zinc-950'
            }`}
          >
            {activeMatch.isRunning ? (
              <>
                <Pause className="h-5 w-5 fill-current" /> Pausar
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" /> Iniciar
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onAddOneMinute}
              className="flex min-h-[44px] items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 text-xs font-extrabold text-zinc-200 active:scale-95"
            >
              +1m
            </button>
            <button
              onClick={onResetTimer}
              className="flex min-h-[44px] items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 text-zinc-400 active:scale-95"
              aria-label="Resetar tempo"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowMatchup(true)}
        disabled={teams.length < 2}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-300 transition hover:border-emerald-500 active:scale-95"
      >
        <Swords className="h-4 w-4 text-emerald-400" />
        Trocar confronto
      </button>

      <div className="grid grid-cols-2 gap-3">
        {[
          { team: teamA, score: activeMatch.scoreA },
          { team: teamB, score: activeMatch.scoreB },
        ].map(({ team, score }) => {
          const gk = goalkeeperName(team);
          return (
            <div
              key={team.id}
              className="flex min-w-0 flex-col items-center rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <span
                className="max-w-full truncate text-xs font-extrabold uppercase tracking-wider"
                style={{ color: team.color }}
              >
                {team.name}
              </span>
              <span className="max-w-full truncate text-[11px] text-zinc-500">
                {gk ? `🧤 ${gk}` : 'sem goleiro'}
              </span>
              <span className="my-2 font-mono text-5xl font-black text-white tabular-nums">
                {score}
              </span>
              <button
                onClick={() => setGoalModalTeam(team)}
                className="mt-1 flex min-h-[48px] w-full items-center justify-center gap-1 rounded-xl bg-zinc-800 text-sm font-extrabold text-white transition hover:bg-emerald-500 hover:text-zinc-950 active:scale-95"
              >
                <Plus className="h-4 w-4 stroke-[3]" /> GOL
              </button>
            </div>
          );
        })}
      </div>

      {activeMatch.events.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Gols da Partida
          </h3>
          {activeMatch.events.map((ev) => {
            const evTeam = teams.find((t) => t.id === ev.teamId);
            const scorerName =
              ev.scorerId === 'own_goal' ? 'Gol Contra' : playerMap.get(ev.scorerId) || 'Jogador';
            const assistName = ev.assistId ? playerMap.get(ev.assistId) : null;

            return (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 pl-3 text-xs"
              >
                <div className="min-w-0 py-2">
                  <span className="font-mono font-bold text-emerald-400">{ev.minuteFormatted}</span>{' '}
                  <span className="font-bold text-white">⚽ {scorerName}</span>
                  {assistName && <span className="text-zinc-400"> (Assist: {assistName})</span>}
                  <span className="ml-2 text-[11px] font-bold" style={{ color: evTeam?.color }}>
                    [{evTeam?.name}]
                  </span>
                </div>
                <button
                  onClick={() => {
                    onRemoveEvent(ev.id);
                    toast.show('Gol removido', 'info');
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-zinc-500 hover:text-red-400"
                  aria-label="Remover gol"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setShowEndModal(true)}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-extrabold text-white transition hover:border-emerald-500"
      >
        <Flag className="h-4 w-4 text-emerald-400" />
        Encerrar Partida e Rotacionar Fila
      </button>

      {goalModalTeam && (
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

      {showEndModal && (
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

      {showMatchup && (
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
