import { useEffect, useRef, useState } from 'react';
import { MOCK_PLAYERS } from '../data/mockPlayers';
import { supabase } from '../lib/supabase';
import {
  GoalEvent,
  MatchRecord,
  Player,
  RachaStoreState,
  RotationRule,
  SortMode,
} from '../types/racha';
import { playRefWhistle } from '../utils/sound';
import { generateTeams } from '../utils/teamBalancer';

const STORAGE_KEY = 'rachapro_state_v1';
const CLOUD_ROW_ID = 'default';

const DEFAULT_STATE: RachaStoreState = {
  players: [],
  teams: [],
  settings: {
    playersPerTeam: 5,
    matchDurationSeconds: 7 * 60,
    sortMode: 'balanced',
  },
  activeMatch: {
    teamAId: null,
    teamBId: null,
    scoreA: 0,
    scoreB: 0,
    events: [],
    secondsRemaining: 7 * 60,
    isRunning: false,
  },
  history: [],
};

export function useRachaStore() {
  const [state, setState] = useState<RachaStoreState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RachaStoreState;
        return {
          ...DEFAULT_STATE,
          ...parsed,
          activeMatch: {
            ...DEFAULT_STATE.activeMatch,
            ...parsed.activeMatch,
            isRunning: false,
          },
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_STATE;
  });

  const isInitialCloudLoad = useRef(true);

  // 1. Carrega dados salvos na nuvem ao abrir o app
  useEffect(() => {
    async function loadFromCloud() {
      if (!supabase) {
        isInitialCloudLoad.current = false;
        return;
      }
      const { data, error } = await supabase
        .from('racha_state')
        .select('data')
        .eq('id', CLOUD_ROW_ID)
        .single();

      if (!error && data?.data && Object.keys(data.data).length > 0) {
        const cloudState = data.data as RachaStoreState;
        setState({
          ...DEFAULT_STATE,
          ...cloudState,
          activeMatch: {
            ...DEFAULT_STATE.activeMatch,
            ...cloudState.activeMatch,
            isRunning: false,
          },
        });
      }
      isInitialCloudLoad.current = false;
    }
    loadFromCloud();
  }, []);

  // 2. Salva no localStorage e sincroniza com a nuvem sempre que houver mudança
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignora
    }

    if (isInitialCloudLoad.current || !supabase) return;

    // Não envia para nuvem a cada segundo do cronômetro (apenas quando pausa, marca gol, encerra, etc.)
    if (state.activeMatch.isRunning) return;

    const timeout = window.setTimeout(async () => {
      if (!supabase) return;
      await supabase
        .from('racha_state')
        .upsert({
          id: CLOUD_ROW_ID,
          data: state,
          updated_at: new Date().toISOString(),
        });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [state]);

  // 3. Tick do cronômetro
  useEffect(() => {
    if (!state.activeMatch.isRunning) return;

    const interval = window.setInterval(() => {
      setState((prev) => {
        if (!prev.activeMatch.isRunning) return prev;
        if (prev.activeMatch.secondsRemaining <= 1) {
          playRefWhistle();
          return {
            ...prev,
            activeMatch: {
              ...prev.activeMatch,
              secondsRemaining: 0,
              isRunning: false,
            },
          };
        }
        return {
          ...prev,
          activeMatch: {
            ...prev.activeMatch,
            secondsRemaining: prev.activeMatch.secondsRemaining - 1,
          },
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state.activeMatch.isRunning]);

  const addPlayer = (name: string, isGoalkeeper: boolean, skill: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newPlayer: Player = {
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      isGoalkeeper,
      skill,
      present: true,
    };
    setState((prev) => ({ ...prev, players: [newPlayer, ...prev.players] }));
  };

  const togglePresence = (playerId: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === playerId ? { ...p, present: !p.present } : p
      ),
    }));
  };

  const removePlayer = (playerId: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
      teams: prev.teams.map((t) => ({
        ...t,
        playerIds: t.playerIds.filter((id) => id !== playerId),
      })),
    }));
  };

  const loadMockPlayers = () => {
    setState((prev) => ({ ...prev, players: MOCK_PLAYERS }));
  };

  const updateSettings = (playersPerTeam: number, sortMode: SortMode) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, playersPerTeam, sortMode },
    }));
  };

  const runTeamSort = () => {
    setState((prev) => {
      const presentPlayers = prev.players.filter((p) => p.present);
      const newTeams = generateTeams(
        presentPlayers,
        prev.settings.playersPerTeam,
        prev.settings.sortMode
      );
      return {
        ...prev,
        teams: newTeams,
        activeMatch: {
          teamAId: newTeams[0]?.id ?? null,
          teamBId: newTeams[1]?.id ?? null,
          scoreA: 0,
          scoreB: 0,
          events: [],
          secondsRemaining: prev.settings.matchDurationSeconds,
          isRunning: false,
        },
      };
    });
  };

  const swapPlayersBetweenTeams = (
    teamAId: string,
    playerAId: string,
    teamBId: string,
    playerBId: string
  ) => {
    if (teamAId === teamBId && playerAId === playerBId) return;
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => {
        if (team.id === teamAId && team.id === teamBId) return team;
        if (team.id === teamAId) {
          return {
            ...team,
            playerIds: team.playerIds.map((id) => (id === playerAId ? playerBId : id)),
          };
        }
        if (team.id === teamBId) {
          return {
            ...team,
            playerIds: team.playerIds.map((id) => (id === playerBId ? playerAId : id)),
          };
        }
        return team;
      }),
    }));
  };

  const toggleTimer = () => {
    setState((prev) => ({
      ...prev,
      activeMatch: {
        ...prev.activeMatch,
        isRunning: !prev.activeMatch.isRunning,
      },
    }));
  };

  const resetTimer = () => {
    setState((prev) => ({
      ...prev,
      activeMatch: {
        ...prev.activeMatch,
        secondsRemaining: prev.settings.matchDurationSeconds,
        isRunning: false,
      },
    }));
  };

  const addOneMinute = () => {
    setState((prev) => ({
      ...prev,
      activeMatch: {
        ...prev.activeMatch,
        secondsRemaining: prev.activeMatch.secondsRemaining + 60,
      },
    }));
  };

  const setMatchDurationMinutes = (minutes: number) => {
    const seconds = minutes * 60;
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, matchDurationSeconds: seconds },
      activeMatch: {
        ...prev.activeMatch,
        secondsRemaining: seconds,
        isRunning: false,
      },
    }));
  };

  const registerGoal = (
    teamId: string,
    scorerId: string | 'own_goal',
    assistId: string | null
  ) => {
    setState((prev) => {
      const elapsed = Math.max(
        0,
        prev.settings.matchDurationSeconds - prev.activeMatch.secondsRemaining
      );
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');

      const newEvent: GoalEvent = {
        id: `goal-${Date.now()}`,
        teamId,
        scorerId,
        assistId,
        minuteFormatted: `${mins}:${secs}`,
        timestamp: Date.now(),
      };

      const isTeamA = teamId === prev.activeMatch.teamAId;
      return {
        ...prev,
        activeMatch: {
          ...prev.activeMatch,
          scoreA: isTeamA ? prev.activeMatch.scoreA + 1 : prev.activeMatch.scoreA,
          scoreB: !isTeamA ? prev.activeMatch.scoreB + 1 : prev.activeMatch.scoreB,
          events: [newEvent, ...prev.activeMatch.events],
        },
      };
    });
  };

  const removeGoalEvent = (eventId: string) => {
    setState((prev) => {
      const target = prev.activeMatch.events.find((e) => e.id === eventId);
      if (!target) return prev;
      const isTeamA = target.teamId === prev.activeMatch.teamAId;
      return {
        ...prev,
        activeMatch: {
          ...prev.activeMatch,
          scoreA: isTeamA ? Math.max(0, prev.activeMatch.scoreA - 1) : prev.activeMatch.scoreA,
          scoreB: !isTeamA ? Math.max(0, prev.activeMatch.scoreB - 1) : prev.activeMatch.scoreB,
          events: prev.activeMatch.events.filter((e) => e.id !== eventId),
        },
      };
    });
  };

  const finishMatchAndRotate = (rule: RotationRule) => {
    setState((prev) => {
      const teamA = prev.teams.find((t) => t.id === prev.activeMatch.teamAId);
      const teamB = prev.teams.find((t) => t.id === prev.activeMatch.teamBId);
      if (!teamA || !teamB) return prev;

      const record: MatchRecord = {
        id: `match-${Date.now()}`,
        teamAName: teamA.name,
        teamBName: teamB.name,
        scoreA: prev.activeMatch.scoreA,
        scoreB: prev.activeMatch.scoreB,
        events: prev.activeMatch.events,
        finishedAt: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      let nextTeams = [...prev.teams];
      if (nextTeams.length > 2) {
        const [first, second, ...rest] = nextTeams;
        if (rule === 'winner_stays') {
          nextTeams =
            prev.activeMatch.scoreB > prev.activeMatch.scoreA
              ? [second, ...rest, first]
              : [first, ...rest, second];
        } else if (rule === 'team_b_stays') {
          nextTeams = [second, ...rest, first];
        } else if (rule === 'team_a_stays') {
          nextTeams = [first, ...rest, second];
        } else {
          nextTeams = [...rest, first, second];
        }
      }

      return {
        ...prev,
        teams: nextTeams,
        history: [record, ...prev.history],
        activeMatch: {
          teamAId: nextTeams[0]?.id ?? null,
          teamBId: nextTeams[1]?.id ?? null,
          scoreA: 0,
          scoreB: 0,
          events: [],
          secondsRemaining: prev.settings.matchDurationSeconds,
          isRunning: false,
        },
      };
    });
  };

  const resetDayStats = () => {
    setState((prev) => ({
      ...prev,
      history: [],
      activeMatch: {
        ...prev.activeMatch,
        scoreA: 0,
        scoreB: 0,
        events: [],
        secondsRemaining: prev.settings.matchDurationSeconds,
        isRunning: false,
      },
    }));
  };

  return {
    state,
    addPlayer,
    togglePresence,
    removePlayer,
    loadMockPlayers,
    updateSettings,
    runTeamSort,
    swapPlayersBetweenTeams,
    toggleTimer,
    resetTimer,
    addOneMinute,
    setMatchDurationMinutes,
    registerGoal,
    removeGoalEvent,
    finishMatchAndRotate,
    resetDayStats,
  };
}
