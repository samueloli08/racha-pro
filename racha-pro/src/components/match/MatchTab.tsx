import React, { useState } from 'react';
import {
  Flag,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  ActiveMatchState,
  Player,
  RotationRule,
  Team,
} from '../../types/racha';
import { playRefWhistle } from '../../utils/sound';
import { EndMatchModal } from './EndMatchModal';
import { GoalModal } from './GoalModal';

interface MatchTabProps {
  activeMatch: ActiveMatchState;
  teams: Team[];
  players: Player[];
  durationSeconds: number;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onAddOneMinute: () => void;
  onChangeDuration: (minutes: number) => void;
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
  onRegisterGoal,
  onRemoveEvent,
  onFinishMatch,
  onGoToSort,
}) => {
  const [goalModalTeam, setGoalModalTeam] = useState<Team | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);

  const teamA = teams.find((t) => t.id === activeMatch.teamAId);
  const teamB = teams.find((t) => t.id === activeMatch.teamBId);
  const playerMap = new Map(players.map((p) => [p.id, p.name]));

  if (!teamA || !teamB) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-sm text-zinc-400">
          Nenhum time sorteado ainda para iniciar a partida.
        </p>
        <button
          onClick={onGoToSort}
          className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-zinc-950"
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

  return (
    <div className="space-y-5">
      <div
        className={`rounded-3xl border p-5 text-center transition ${
          isTimeOver
            ? 'animate-pulse border-amber-500 bg-amber-500/15'
            : 'border-zinc-800 bg-zinc-900'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-1">
            {[5, 7, 8, 10].map((m) => (
              <button
                key={m}
                onClick={() => onChangeDuration(m)}
                className={`rounded-lg px-2 py-1 text-xs font-bold ${
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
            onClick={playRefWhistle}
            className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300"
            title="Testar Apito"
          >
            <Volume2 className="h-3.5 w-3.5 text-emerald-400" /> Apito
          </button>
        </div>

        <div className="my-2 font-mono text-6xl font-black tracking-tight text-white tabular-nums">
          {mins}:{secs}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={onToggleTimer}
            className={`col-span-2 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-extrabold transition active:scale-95 ${
              activeMatch.isRunning
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-emerald-500 text-zinc-950'
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
              className="flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 text-xs font-extrabold text-zinc-200 active:scale-95"
            >
              +1m
            </button>
            <button
              onClick={onResetTimer}
              className="flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 text-zinc-400 active:scale-95"
              aria-label="Resetar tempo"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { team: teamA, score: activeMatch.scoreA },
          { team: teamB, score: activeMatch.scoreB },
        ].map(({ team, score }) => (
          <div
            key={team.id}
            className="flex flex-col items-center rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <span
              className="text-xs font-extrabold uppercase tracking-wider"
              style={{ color: team.color }}
            >
              {team.name}
            </span>
            <span className="my-2 font-mono text-5xl font-black text-white tabular-nums">
              {score}
            </span>
            <button
              onClick={() => setGoalModalTeam(team)}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-xl bg-zinc-800 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-500 hover:text-zinc-950 active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" /> GOL
            </button>
          </div>
        ))}
      </div>

      {activeMatch.events.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Gols da Partida
          </h3>
          {activeMatch.events.map((ev) => {
            const evTeam = teams.find((t) => t.id === ev.teamId);
            const scorerName =
              ev.scorerId === 'own_goal'
                ? 'Gol Contra'
                : playerMap.get(ev.scorerId) || 'Jogador';
            const assistName = ev.assistId ? playerMap.get(ev.assistId) : null;

            return (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-emerald-400">
                    {ev.minuteFormatted}
                  </span>{' '}
                  <span className="font-bold text-white">⚽ {scorerName}</span>
                  {assistName && (
                    <span className="text-zinc-400"> (Assist: {assistName})</span>
                  )}
                  <span
                    className="ml-2 text-[10px] font-bold"
                    style={{ color: evTeam?.color }}
                  >
                    [{evTeam?.name}]
                  </span>
                </div>
                <button
                  onClick={() => onRemoveEvent(ev.id)}
                  className="p-1 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setShowEndModal(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 py-3.5 text-sm font-extrabold text-white transition hover:border-emerald-500"
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
          onConfirm={(rule) => {
            onFinishMatch(rule);
            setShowEndModal(false);
          }}
          onClose={() => setShowEndModal(false)}
        />
      )}
    </div>
  );
};
