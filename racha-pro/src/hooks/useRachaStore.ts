import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { MOCK_PLAYERS } from '../data/mockPlayers';
import { supabase } from '../lib/supabase';
import {
  GoalEvent,
  MatchRecord,
  Player,
  RachaStoreState,
  RotationRule,
  SortMode,
  SyncStatus,
  Team,
} from '../types/racha';
import { isNonEmptyObject, stableStringify } from '../utils/json';
import {
  playOneMinuteWarning,
  signalMatchEnd,
  unlockAudio,
} from '../utils/sound';
import { computeStatsFromHistory, mergeStats } from '../utils/stats';
import { generateTeams } from '../utils/teamBalancer';
import { useWakeLock } from './useWakeLock';

// Mantemos as mesmas chaves para continuar compatível com os dados já salvos.
const STORAGE_KEY = 'rachapro_state_v1';
const DIRTY_KEY = 'rachapro_dirty_v1';
const CLOUD_ROW_ID = 'default';
const PUSH_DEBOUNCE_MS = 600;
const RETRY_INTERVAL_MS = 15000;

interface RemoteRow {
  id: string;
  data: unknown;
}

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
  allTimeStats: {},
  checkInCounter: 0,
  archivedDays: 0,
  archivedMatches: 0,
};

/** Aceita qualquer dado antigo (localStorage / nuvem) e completa os campos novos. */
function normalizeState(raw: unknown): RachaStoreState {
  const parsed = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<RachaStoreState>;
  return {
    ...DEFAULT_STATE,
    ...parsed,
    players: Array.isArray(parsed.players) ? parsed.players : [],
    teams: Array.isArray(parsed.teams) ? parsed.teams : [],
    history: Array.isArray(parsed.history) ? parsed.history : [],
    settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
    activeMatch: { ...DEFAULT_STATE.activeMatch, ...parsed.activeMatch },
    allTimeStats:
      typeof parsed.allTimeStats === 'object' && parsed.allTimeStats !== null
        ? parsed.allTimeStats
        : {},
  };
}

function loadInitialState(): RachaStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const normalized = normalizeState(JSON.parse(raw));
      return { ...normalized, activeMatch: { ...normalized.activeMatch, isRunning: false } };
    }
  } catch {
    // fallback
  }
  return DEFAULT_STATE;
}

/**
 * Chave usada para saber se há algo novo para enviar à nuvem.
 * Ignora `isRunning` e o contador de segundos enquanto o cronômetro corre.
 */
function syncKey(state: RachaStoreState): string {
  return stableStringify({
    ...state,
    activeMatch: {
      ...state.activeMatch,
      isRunning: false,
      secondsRemaining: state.activeMatch.isRunning ? -1 : state.activeMatch.secondsRemaining,
    },
  });
}

function toCloudPayload(state: RachaStoreState): RachaStoreState {
  return { ...state, activeMatch: { ...state.activeMatch, isRunning: false } };
}

/** Aplica um estado vindo da nuvem preservando o cronômetro local quando está correndo. */
function applyRemote(local: RachaStoreState, remoteRaw: unknown): RachaStoreState {
  const remote = normalizeState(remoteRaw);
  if (local.activeMatch.isRunning) {
    return {
      ...remote,
      activeMatch: {
        ...remote.activeMatch,
        isRunning: true,
        secondsRemaining: local.activeMatch.secondsRemaining,
      },
    };
  }
  return { ...remote, activeMatch: { ...remote.activeMatch, isRunning: false } };
}

function readDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDirty(value: boolean): void {
  try {
    if (value) localStorage.setItem(DIRTY_KEY, '1');
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    // ignora
  }
}

function findGoalkeeperId(team: Team, players: Player[]): string | null {
  const byId = new Map(players.map((p) => [p.id, p]));
  const gk = team.playerIds.find((id) => byId.get(id)?.isGoalkeeper);
  return gk ?? null;
}

export function useRachaStore() {
  const [state, setState] = useState<RachaStoreState>(loadInitialState);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    if (!supabase) return 'offline';
    return navigator.onLine ? 'saving' : 'offline';
  });
  const [cloudReady, setCloudReady] = useState(false);
  const [remoteUpdateTick, setRemoteUpdateTick] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSyncedKeyRef = useRef<string | null>(null);
  const cloudReadyRef = useRef(false);

  const currentKey = useMemo(() => syncKey(state), [state]);

  // Tela sempre acesa enquanto o cronômetro roda
  useWakeLock(state.activeMatch.isRunning);

  // ---------------------------------------------------------------------------
  // Nuvem: leitura (inicial e reconexão)
  // ---------------------------------------------------------------------------
  const syncFromCloud = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('racha_state')
        .select('data')
        .eq('id', CLOUD_ROW_ID)
        .maybeSingle();
      if (error) throw error;

      const cloud: unknown = data?.data;
      // Se houver alterações locais ainda não enviadas, elas têm prioridade.
      const hasUnsynced = cloudReadyRef.current
        ? syncKey(stateRef.current) !== lastSyncedKeyRef.current
        : readDirty();

      if (isNonEmptyObject(cloud) && !hasUnsynced) {
        const next = applyRemote(stateRef.current, cloud);
        lastSyncedKeyRef.current = syncKey(next);
        if (syncKey(next) !== syncKey(stateRef.current)) setState(next);
        setSyncStatus('synced');
      }

      cloudReadyRef.current = true;
      setCloudReady(true);
    } catch {
      setSyncStatus('offline');
    }
  }, []);

  useEffect(() => {
    void syncFromCloud();
  }, [syncFromCloud]);

  // ---------------------------------------------------------------------------
  // Nuvem: escrita (com debounce)
  // ---------------------------------------------------------------------------
  const pushToCloud = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    const snapshot = stateRef.current;
    const snapshotKey = syncKey(snapshot);

    if (snapshotKey === lastSyncedKeyRef.current) {
      writeDirty(false);
      setSyncStatus('synced');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    try {
      const { error } = await supabase.from('racha_state').upsert({
        id: CLOUD_ROW_ID,
        data: toCloudPayload(snapshot),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      lastSyncedKeyRef.current = snapshotKey;
      if (syncKey(stateRef.current) === snapshotKey) {
        writeDirty(false);
        setSyncStatus('synced');
      } else {
        setSyncStatus('saving');
      }
    } catch {
      setSyncStatus('offline');
    }
  }, []);

  // Salva no localStorage a cada mudança (inclusive tique do cronômetro)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignora
    }
  }, [state]);

  // Agenda o envio à nuvem quando algo relevante mudou
  useEffect(() => {
    if (!supabase || !cloudReady) return;
    if (currentKey === lastSyncedKeyRef.current) return;

    writeDirty(true);
    setSyncStatus(navigator.onLine ? 'saving' : 'offline');

    const timeout = window.setTimeout(() => {
      void pushToCloud();
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [currentKey, cloudReady, pushToCloud]);

  // Conectividade: reenvia ao voltar a internet e tenta periodicamente
  const retrySync = useCallback((): void => {
    if (!supabase) return;
    if (!cloudReadyRef.current) void syncFromCloud();
    else void pushToCloud();
  }, [pushToCloud, syncFromCloud]);

  useEffect(() => {
    if (!supabase) return;
    const goOnline = () => retrySync();
    const goOffline = () => setSyncStatus('offline');
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const interval = window.setInterval(() => {
      if (navigator.onLine) retrySync();
    }, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(interval);
    };
  }, [retrySync]);

  // ---------------------------------------------------------------------------
  // Supabase Realtime
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const channel = client
      .channel(`racha_state_${CLOUD_ROW_ID}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'racha_state', filter: `id=eq.${CLOUD_ROW_ID}` },
        (payload: RealtimePostgresChangesPayload<RemoteRow>) => {
          if (payload.eventType === 'DELETE') return;
          const remoteData: unknown = payload.new.data;
          if (!isNonEmptyObject(remoteData)) return;

          const local = stateRef.current;
          // Alterações locais pendentes vencem (serão enviadas em instantes)
          if (cloudReadyRef.current && syncKey(local) !== lastSyncedKeyRef.current) return;

          const next = applyRemote(local, remoteData);
          const nextKey = syncKey(next);
          // Eco do nosso próprio envio (ou nada mudou): ignora
          if (nextKey === syncKey(local)) {
            lastSyncedKeyRef.current = nextKey;
            return;
          }

          lastSyncedKeyRef.current = nextKey;
          setState(next);
          setSyncStatus('synced');
          setRemoteUpdateTick((t) => t + 1);
        }
      )
      .subscribe((status) => {
        // Ao (re)conectar o canal, busca o que perdemos enquanto estava fora
        if (status === 'SUBSCRIBED' && cloudReadyRef.current) void syncFromCloud();
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [syncFromCloud]);

  // ---------------------------------------------------------------------------
  // Cronômetro
  // ---------------------------------------------------------------------------
  const { isRunning, secondsRemaining } = state.activeMatch;
  const matchDuration = state.settings.matchDurationSeconds;

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setState((prev) => {
        if (!prev.activeMatch.isRunning) return prev;
        if (prev.activeMatch.secondsRemaining <= 1) {
          return {
            ...prev,
            activeMatch: { ...prev.activeMatch, secondsRemaining: 0, isRunning: false },
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
  }, [isRunning]);

  // Alertas: aviso de 1 minuto e apito + vibração no fim (fora do setState, sem efeito colateral duplicado)
  const wasRunningRef = useRef(false);
  const warnedRef = useRef(false);
  useEffect(() => {
    if (secondsRemaining > 60) warnedRef.current = false;

    if (isRunning && secondsRemaining === 60 && matchDuration > 60 && !warnedRef.current) {
      warnedRef.current = true;
      playOneMinuteWarning();
    }

    if (wasRunningRef.current && !isRunning && secondsRemaining === 0) {
      signalMatchEnd();
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, secondsRemaining, matchDuration]);

  // ---------------------------------------------------------------------------
  // Jogadores
  // ---------------------------------------------------------------------------
  const addPlayer = (name: string, isGoalkeeper: boolean, skill: number): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setState((prev) => {
      const order = prev.checkInCounter + 1;
      const newPlayer: Player = {
        id,
        name: trimmed,
        isGoalkeeper,
        skill,
        present: true,
        checkInOrder: order,
      };
      return { ...prev, checkInCounter: order, players: [newPlayer, ...prev.players] };
    });
    return id;
  };

  const togglePresence = (playerId: string) => {
    setState((prev) => {
      const target = prev.players.find((p) => p.id === playerId);
      if (!target) return prev;
      if (target.present) {
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, present: false, checkInOrder: undefined } : p
          ),
        };
      }
      const order = prev.checkInCounter + 1;
      return {
        ...prev,
        checkInCounter: order,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, present: true, checkInOrder: order } : p
        ),
      };
    });
  };

  const setAllPresence = (present: boolean) => {
    setState((prev) => {
      if (!present) {
        return {
          ...prev,
          players: prev.players.map((p) => ({ ...p, present: false, checkInOrder: undefined })),
        };
      }
      let counter = prev.checkInCounter;
      return {
        ...prev,
        players: prev.players.map((p) => {
          if (p.present) return p;
          counter += 1;
          return { ...p, present: true, checkInOrder: counter };
        }),
        checkInCounter: counter,
      };
    });
  };

  const updatePlayer = (
    playerId: string,
    patch: Partial<Pick<Player, 'name' | 'isGoalkeeper' | 'skill'>>
  ) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        const name = patch.name !== undefined ? patch.name.trim() : p.name;
        return { ...p, ...patch, name: name || p.name };
      }),
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
    setState((prev) => ({
      ...prev,
      players: MOCK_PLAYERS.map((p, idx) => ({ ...p, checkInOrder: prev.checkInCounter + idx + 1 })),
      checkInCounter: prev.checkInCounter + MOCK_PLAYERS.length,
    }));
  };

  // ---------------------------------------------------------------------------
  // Sorteio e times
  // ---------------------------------------------------------------------------
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

  const renameTeam = (teamId: string, name: string) => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, name: trimmed } : t)),
    }));
  };

  const setTeamColor = (teamId: string, color: string) => {
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, color } : t)),
    }));
  };

  /** Coloca (ou move) um jogador em um time específico sem refazer o sorteio. */
  const addPlayerToTeam = (playerId: string, teamId: string) => {
    setState((prev) => {
      if (!prev.teams.some((t) => t.id === teamId)) return prev;
      const player = prev.players.find((p) => p.id === playerId);
      if (!player) return prev;

      const needsCheckIn = !player.present;
      const order = prev.checkInCounter + 1;
      return {
        ...prev,
        checkInCounter: needsCheckIn ? order : prev.checkInCounter,
        players: needsCheckIn
          ? prev.players.map((p) =>
              p.id === playerId ? { ...p, present: true, checkInOrder: order } : p
            )
          : prev.players,
        teams: prev.teams.map((t) => {
          const without = t.playerIds.filter((id) => id !== playerId);
          return t.id === teamId ? { ...t, playerIds: [...without, playerId] } : { ...t, playerIds: without };
        }),
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Partida
  // ---------------------------------------------------------------------------
  const toggleTimer = () => {
    unlockAudio();
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

  /** Escolhe manualmente quais times jogam. Os escolhidos vão para o início da fila. */
  const setMatchup = (teamAId: string, teamBId: string) => {
    if (teamAId === teamBId) return;
    setState((prev) => {
      const teamA = prev.teams.find((t) => t.id === teamAId);
      const teamB = prev.teams.find((t) => t.id === teamBId);
      if (!teamA || !teamB) return prev;
      const rest = prev.teams.filter((t) => t.id !== teamAId && t.id !== teamBId);
      return {
        ...prev,
        teams: [teamA, teamB, ...rest],
        activeMatch: {
          teamAId,
          teamBId,
          scoreA: 0,
          scoreB: 0,
          events: [],
          secondsRemaining: prev.settings.matchDurationSeconds,
          isRunning: false,
        },
      };
    });
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
        teamAId: teamA.id,
        teamBId: teamB.id,
        teamAPlayerIds: [...teamA.playerIds],
        teamBPlayerIds: [...teamB.playerIds],
        goalkeeperAId: findGoalkeeperId(teamA, prev.players),
        goalkeeperBId: findGoalkeeperId(teamB, prev.players),
        rule,
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

  // ---------------------------------------------------------------------------
  // Estatísticas / histórico
  // ---------------------------------------------------------------------------
  const clearedActiveMatch = (prev: RachaStoreState) => ({
    ...prev.activeMatch,
    scoreA: 0,
    scoreB: 0,
    events: [],
    secondsRemaining: prev.settings.matchDurationSeconds,
    isRunning: false,
  });

  /** Descarta os números do dia sem somar ao histórico geral. */
  const resetDayStats = () => {
    setState((prev) => ({
      ...prev,
      history: [],
      activeMatch: clearedActiveMatch(prev),
    }));
  };

  /** Soma os números do dia ao acumulado histórico e zera o dia. */
  const archiveDay = () => {
    setState((prev) => {
      if (prev.history.length === 0) return prev;
      const dayStats = computeStatsFromHistory(prev.history, prev.players);
      return {
        ...prev,
        allTimeStats: mergeStats(prev.allTimeStats, dayStats),
        archivedDays: prev.archivedDays + 1,
        archivedMatches: prev.archivedMatches + prev.history.length,
        history: [],
        activeMatch: clearedActiveMatch(prev),
      };
    });
  };

  const resetAllTimeStats = () => {
    setState((prev) => ({
      ...prev,
      allTimeStats: {},
      archivedDays: 0,
      archivedMatches: 0,
    }));
  };

  return {
    state,
    syncStatus,
    remoteUpdateTick,
    retrySync,
    addPlayer,
    togglePresence,
    setAllPresence,
    updatePlayer,
    removePlayer,
    loadMockPlayers,
    updateSettings,
    runTeamSort,
    swapPlayersBetweenTeams,
    renameTeam,
    setTeamColor,
    addPlayerToTeam,
    toggleTimer,
    resetTimer,
    addOneMinute,
    setMatchDurationMinutes,
    setMatchup,
    registerGoal,
    removeGoalEvent,
    finishMatchAndRotate,
    resetDayStats,
    archiveDay,
    resetAllTimeStats,
  };
}
