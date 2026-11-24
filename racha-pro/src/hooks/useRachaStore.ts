import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { MOCK_PLAYERS } from '../data/mockPlayers';
import { supabase } from '../lib/supabase';
import {
  AllTimePlayerStats,
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

const PUSH_DEBOUNCE_MS = 600;
const RETRY_INTERVAL_MS = 15000;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

interface RemoteRow {
  id: string;
  data: unknown;
}

export interface UseRachaStoreOptions {
  rachaId: string;
  shareCode: string;
  initialData?: unknown;
  readOnly?: boolean;
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

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function safeStr(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLen);
}

function sanitizeHexColor(value: unknown): string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value) ? value : '#10b981';
}

function sanitizePlayers(raw: unknown): Player[] {
  if (!Array.isArray(raw)) return [];
  const out: Player[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Partial<Player>;
    const id = safeStr(p.id, 80).trim();
    const name = safeStr(p.name, 60).trim();
    if (!id || !name) continue;
    out.push({
      id,
      name,
      isGoalkeeper: Boolean(p.isGoalkeeper),
      skill: clampInt(p.skill, 1, 5, 3),
      present: Boolean(p.present),
      checkInOrder:
        typeof p.checkInOrder === 'number' && Number.isFinite(p.checkInOrder)
          ? p.checkInOrder
          : undefined,
    });
  }
  return out;
}

function sanitizeTeams(raw: unknown): Team[] {
  if (!Array.isArray(raw)) return [];
  const out: Team[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const t = item as Partial<Team>;
    const id = safeStr(t.id, 80).trim();
    const name = safeStr(t.name, 40).trim();
    if (!id || !name) continue;
    const playerIds = Array.isArray(t.playerIds)
      ? t.playerIds.filter((pid): pid is string => typeof pid === 'string' && pid.length <= 80)
      : [];
    out.push({
      id,
      name,
      color: sanitizeHexColor(t.color),
      playerIds,
    });
  }
  return out;
}

function sanitizeEvents(raw: unknown): GoalEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: GoalEvent[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const e = item as Partial<GoalEvent>;
    const id = safeStr(e.id, 80).trim();
    const teamId = safeStr(e.teamId, 80).trim();
    const scorerId = safeStr(e.scorerId, 80).trim();
    if (!id || !teamId || !scorerId) continue;
    out.push({
      id,
      teamId,
      scorerId,
      assistId: typeof e.assistId === 'string' && e.assistId ? e.assistId.slice(0, 80) : null,
      minuteFormatted: safeStr(e.minuteFormatted, 16, '00:00'),
      timestamp: typeof e.timestamp === 'number' && Number.isFinite(e.timestamp) ? e.timestamp : 0,
    });
  }
  return out;
}

function sanitizeHistory(raw: unknown): MatchRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: MatchRecord[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const m = item as Partial<MatchRecord>;
    const id = safeStr(m.id, 80).trim();
    if (!id) continue;
    out.push({
      id,
      teamAName: safeStr(m.teamAName, 40, 'Time A'),
      teamBName: safeStr(m.teamBName, 40, 'Time B'),
      scoreA: clampInt(m.scoreA, 0, 999, 0),
      scoreB: clampInt(m.scoreB, 0, 999, 0),
      events: sanitizeEvents(m.events),
      finishedAt: safeStr(m.finishedAt, 20, ''),
      teamAId: typeof m.teamAId === 'string' ? m.teamAId.slice(0, 80) : undefined,
      teamBId: typeof m.teamBId === 'string' ? m.teamBId.slice(0, 80) : undefined,
      teamAPlayerIds: Array.isArray(m.teamAPlayerIds)
        ? m.teamAPlayerIds.filter((pid): pid is string => typeof pid === 'string')
        : undefined,
      teamBPlayerIds: Array.isArray(m.teamBPlayerIds)
        ? m.teamBPlayerIds.filter((pid): pid is string => typeof pid === 'string')
        : undefined,
      goalkeeperAId: typeof m.goalkeeperAId === 'string' ? m.goalkeeperAId : m.goalkeeperAId === null ? null : undefined,
      goalkeeperBId: typeof m.goalkeeperBId === 'string' ? m.goalkeeperBId : m.goalkeeperBId === null ? null : undefined,
      rule:
        m.rule === 'winner_stays' ||
        m.rule === 'both_leave' ||
        m.rule === 'team_a_stays' ||
        m.rule === 'team_b_stays'
          ? m.rule
          : undefined,
    });
  }
  return out;
}

function sanitizeAllTimeStats(raw: unknown): Record<string, AllTimePlayerStats> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, AllTimePlayerStats> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof val !== 'object' || val === null) continue;
    const s = val as Partial<AllTimePlayerStats>;
    out[key.slice(0, 80)] = {
      name: safeStr(s.name, 60, 'Jogador'),
      goals: clampInt(s.goals, 0, 100000, 0),
      assists: clampInt(s.assists, 0, 100000, 0),
      wins: clampInt(s.wins, 0, 100000, 0),
      matches: clampInt(s.matches, 0, 100000, 0),
      gkMatches: clampInt(s.gkMatches, 0, 100000, 0),
      cleanSheets: clampInt(s.cleanSheets, 0, 100000, 0),
      goalsConceded: clampInt(s.goalsConceded, 0, 100000, 0),
    };
  }
  return out;
}

/** Valida e sanitiza qualquer dado vindo do localStorage ou da nuvem (protege contra JSONB malformado). */
function normalizeState(raw: unknown): RachaStoreState {
  const parsed = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<RachaStoreState>;
  const rawSettings = (
    typeof parsed.settings === 'object' && parsed.settings !== null ? parsed.settings : {}
  ) as Partial<RachaStoreState['settings']>;
  const rawMatch = (
    typeof parsed.activeMatch === 'object' && parsed.activeMatch !== null ? parsed.activeMatch : {}
  ) as Partial<RachaStoreState['activeMatch']>;

  const matchDurationSeconds = clampInt(
    rawSettings.matchDurationSeconds,
    60,
    3600,
    DEFAULT_STATE.settings.matchDurationSeconds
  );

  return {
    players: sanitizePlayers(parsed.players),
    teams: sanitizeTeams(parsed.teams),
    history: sanitizeHistory(parsed.history),
    settings: {
      playersPerTeam: clampInt(
        rawSettings.playersPerTeam,
        2,
        15,
        DEFAULT_STATE.settings.playersPerTeam
      ),
      matchDurationSeconds,
      sortMode: rawSettings.sortMode === 'random' ? 'random' : 'balanced',
    },
    activeMatch: {
      teamAId: typeof rawMatch.teamAId === 'string' ? rawMatch.teamAId.slice(0, 80) : null,
      teamBId: typeof rawMatch.teamBId === 'string' ? rawMatch.teamBId.slice(0, 80) : null,
      scoreA: clampInt(rawMatch.scoreA, 0, 999, 0),
      scoreB: clampInt(rawMatch.scoreB, 0, 999, 0),
      events: sanitizeEvents(rawMatch.events),
      secondsRemaining: clampInt(rawMatch.secondsRemaining, 0, 7200, matchDurationSeconds),
      isRunning: Boolean(rawMatch.isRunning),
    },
    allTimeStats: sanitizeAllTimeStats(parsed.allTimeStats),
    checkInCounter: clampInt(parsed.checkInCounter, 0, 1000000, 0),
    archivedDays: clampInt(parsed.archivedDays, 0, 100000, 0),
    archivedMatches: clampInt(parsed.archivedMatches, 0, 1000000, 0),
  };
}

function storageKeyOf(rachaId: string): string {
  return `rachapro_racha_${rachaId}`;
}

function dirtyKeyOf(rachaId: string): string {
  return `rachapro_dirty_${rachaId}`;
}

function readDirty(rachaId: string): boolean {
  try {
    return localStorage.getItem(dirtyKeyOf(rachaId)) === '1';
  } catch {
    return false;
  }
}

function writeDirty(rachaId: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(dirtyKeyOf(rachaId), '1');
    else localStorage.removeItem(dirtyKeyOf(rachaId));
  } catch {
    // ignora
  }
}

function isAuthError(err: unknown): boolean {
  const obj = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: string;
    status?: number;
    message?: string;
  };
  const code = obj.code ?? '';
  const msg = (obj.message ?? '').toLowerCase();
  return (
    code === 'PGRST301' ||
    code === '42501' ||
    obj.status === 401 ||
    obj.status === 403 ||
    msg.includes('jwt')
  );
}

function loadInitialState(
  rachaId: string,
  initialData: unknown,
  readOnly: boolean
): RachaStoreState {
  if (!readOnly && readDirty(rachaId)) {
    try {
      const raw = localStorage.getItem(storageKeyOf(rachaId));
      if (raw) {
        const normalized = normalizeState(JSON.parse(raw));
        return { ...normalized, activeMatch: { ...normalized.activeMatch, isRunning: false } };
      }
    } catch {
      // fallback para initialData
    }
  }

  if (isNonEmptyObject(initialData)) {
    const normalized = normalizeState(initialData);
    return { ...normalized, activeMatch: { ...normalized.activeMatch, isRunning: false } };
  }

  if (!readOnly) {
    try {
      const raw = localStorage.getItem(storageKeyOf(rachaId));
      if (raw) {
        const normalized = normalizeState(JSON.parse(raw));
        return { ...normalized, activeMatch: { ...normalized.activeMatch, isRunning: false } };
      }
    } catch {
      // fallback
    }
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

function findGoalkeeperId(team: Team, players: Player[]): string | null {
  const byId = new Map(players.map((p) => [p.id, p]));
  const gk = team.playerIds.find((id) => byId.get(id)?.isGoalkeeper);
  return gk ?? null;
}

export function useRachaStore({
  rachaId,
  shareCode,
  initialData,
  readOnly = false,
}: UseRachaStoreOptions) {
  const [state, setState] = useState<RachaStoreState>(() =>
    loadInitialState(rachaId, initialData, readOnly)
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    if (!supabase) return 'offline';
    return navigator.onLine ? (readOnly ? 'synced' : 'saving') : 'offline';
  });
  const [cloudReady, setCloudReady] = useState(false);
  const [remoteUpdateTick, setRemoteUpdateTick] = useState(0);
  const [authExpired, setAuthExpired] = useState(false);
  const [linkRevoked, setLinkRevoked] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSyncedKeyRef = useRef<string | null>(
    isNonEmptyObject(initialData) && (readOnly || !readDirty(rachaId))
      ? syncKey(normalizeState(initialData))
      : null
  );
  const cloudReadyRef = useRef(false);
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);

  const currentKey = useMemo(() => syncKey(state), [state]);

  // Tela sempre acesa enquanto o cronômetro roda (apenas quando está gerenciando)
  useWakeLock(!readOnly && state.activeMatch.isRunning);

  // ---------------------------------------------------------------------------
  // Nuvem: leitura (dono via tabela protegida por RLS; visitante via RPC segura)
  // ---------------------------------------------------------------------------
  const syncFromCloud = useCallback(
    async (notifyIfChanged = false): Promise<void> => {
      if (!supabase || !rachaId) return;
      try {
        let cloud: unknown = null;

        if (readOnly) {
          const { data, error } = await supabase.rpc('get_racha_by_share_code', {
            p_share_code: shareCode.trim().toLowerCase(),
          });
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          if (!row) {
            setLinkRevoked(true);
            setSyncStatus('offline');
            return;
          }
          setLinkRevoked(false);
          cloud = (row as { data?: unknown }).data;
        } else {
          const { data, error } = await supabase
            .from('rachas')
            .select('data')
            .eq('id', rachaId)
            .maybeSingle();
          if (error) throw error;
          cloud = data?.data;
        }

        const hasUnsynced = readOnly
          ? false
          : cloudReadyRef.current
          ? syncKey(stateRef.current) !== lastSyncedKeyRef.current
          : readDirty(rachaId);

        if (isNonEmptyObject(cloud) && !hasUnsynced) {
          const next = applyRemote(stateRef.current, cloud);
          const nextKey = syncKey(next);
          lastSyncedKeyRef.current = nextKey;
          if (nextKey !== syncKey(stateRef.current)) {
            setState(next);
            if (notifyIfChanged) setRemoteUpdateTick((t) => t + 1);
          }
          setSyncStatus('synced');
        } else if (!hasUnsynced) {
          lastSyncedKeyRef.current = syncKey(stateRef.current);
          setSyncStatus('synced');
        }

        setAuthExpired(false);
        cloudReadyRef.current = true;
        setCloudReady(true);
      } catch (err) {
        if (!readOnly && isAuthError(err)) {
          setAuthExpired(true);
        }
        setSyncStatus('offline');
      }
    },
    [rachaId, readOnly, shareCode]
  );

  useEffect(() => {
    void syncFromCloud(false);
  }, [syncFromCloud]);

  // ---------------------------------------------------------------------------
  // Nuvem: escrita (com debounce, somente para o dono)
  // ---------------------------------------------------------------------------
  const pushToCloud = useCallback(async (): Promise<void> => {
    if (!supabase || !rachaId || readOnly) return;
    const snapshot = stateRef.current;
    const snapshotKey = syncKey(snapshot);

    if (snapshotKey === lastSyncedKeyRef.current) {
      writeDirty(rachaId, false);
      setSyncStatus('synced');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    try {
      const { error } = await supabase
        .from('rachas')
        .update({
          data: toCloudPayload(snapshot),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rachaId);
      if (error) throw error;

      setAuthExpired(false);
      lastSyncedKeyRef.current = snapshotKey;
      if (syncKey(stateRef.current) === snapshotKey) {
        writeDirty(rachaId, false);
        setSyncStatus('synced');
      } else {
        setSyncStatus('saving');
      }

      // Sinal leve (sem dados) para visitantes em modo leitura atualizarem imediatamente via RPC
      const ch = broadcastChannelRef.current;
      if (ch) {
        void ch
          .send({
            type: 'broadcast',
            event: 'state_updated',
            payload: { ts: Date.now() },
          })
          .catch(() => undefined);
      }
    } catch (err) {
      if (isAuthError(err)) {
        setAuthExpired(true);
      }
      setSyncStatus('offline');
    }
  }, [rachaId, readOnly]);

  // Salva no localStorage por racha (apenas para o dono)
  useEffect(() => {
    if (readOnly || !rachaId) return;
    try {
      localStorage.setItem(storageKeyOf(rachaId), JSON.stringify(state));
    } catch {
      // ignora
    }
  }, [state, rachaId, readOnly]);

  // Agenda o envio à nuvem quando algo relevante mudou
  useEffect(() => {
    if (!supabase || !cloudReady || readOnly || !rachaId) return;
    if (currentKey === lastSyncedKeyRef.current) return;

    writeDirty(rachaId, true);
    setSyncStatus(navigator.onLine ? 'saving' : 'offline');

    const timeout = window.setTimeout(() => {
      void pushToCloud();
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [currentKey, cloudReady, pushToCloud, readOnly, rachaId]);

  // Se desmontar (ex: trocar de racha) com alteração pendente, tenta enviar logo
  const pushRef = useRef(pushToCloud);
  pushRef.current = pushToCloud;
  useEffect(() => {
    return () => {
      if (!readOnly && cloudReadyRef.current && syncKey(stateRef.current) !== lastSyncedKeyRef.current) {
        void pushRef.current();
      }
    };
  }, [readOnly]);

  // Conectividade: reenvia ao voltar a internet e tenta periodicamente
  const retrySync = useCallback((): void => {
    if (!supabase) return;
    if (readOnly) void syncFromCloud(true);
    else if (!cloudReadyRef.current) void syncFromCloud(false);
    else void pushToCloud();
  }, [pushToCloud, syncFromCloud, readOnly]);

  useEffect(() => {
    if (!supabase) return;
    const goOnline = () => retrySync();
    const goOffline = () => setSyncStatus('offline');
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const interval = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') retrySync();
    }, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(interval);
    };
  }, [retrySync]);

  // ---------------------------------------------------------------------------
  // Supabase Realtime:
  // - Dono: postgres_changes (multi-aparelho protegido por RLS) + canal de broadcast p/ visitantes
  // - Visitante (somente leitura): escuta broadcast e busca via RPC segura
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase || !rachaId || !shareCode) return;
    const client = supabase;

    const liveChannel = client.channel(`racha_live_${shareCode.toLowerCase()}`);
    if (readOnly) {
      liveChannel.on('broadcast', { event: 'state_updated' }, () => {
        void syncFromCloud(true);
      });
    }
    liveChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && readOnly && cloudReadyRef.current) {
        void syncFromCloud(true);
      }
    });
    broadcastChannelRef.current = liveChannel;

    let ownerChangesChannel: RealtimeChannel | null = null;
    if (!readOnly) {
      ownerChangesChannel = client
        .channel(`racha_owner_${rachaId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rachas', filter: `id=eq.${rachaId}` },
          (payload: RealtimePostgresChangesPayload<RemoteRow>) => {
            if (payload.eventType === 'DELETE') return;
            const remoteData: unknown = payload.new.data;
            if (!isNonEmptyObject(remoteData)) return;

            const local = stateRef.current;
            if (cloudReadyRef.current && syncKey(local) !== lastSyncedKeyRef.current) {
              return;
            }

            const next = applyRemote(local, remoteData);
            const nextKey = syncKey(next);
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
          if (status === 'SUBSCRIBED' && cloudReadyRef.current) void syncFromCloud(false);
        });
    }

    return () => {
      broadcastChannelRef.current = null;
      void client.removeChannel(liveChannel);
      if (ownerChangesChannel) void client.removeChannel(ownerChangesChannel);
    };
  }, [rachaId, shareCode, readOnly, syncFromCloud]);

  // ---------------------------------------------------------------------------
  // Cronômetro
  // ---------------------------------------------------------------------------
  const { isRunning, secondsRemaining } = state.activeMatch;
  const matchDuration = state.settings.matchDurationSeconds;

  useEffect(() => {
    if (readOnly || !isRunning) return;
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
  }, [isRunning, readOnly]);

  // Alertas: aviso de 1 minuto e apito + vibração no fim
  const wasRunningRef = useRef(false);
  const warnedRef = useRef(false);
  useEffect(() => {
    if (readOnly) return;
    if (secondsRemaining > 60) warnedRef.current = false;

    if (isRunning && secondsRemaining === 60 && matchDuration > 60 && !warnedRef.current) {
      warnedRef.current = true;
      playOneMinuteWarning();
    }

    if (wasRunningRef.current && !isRunning && secondsRemaining === 0) {
      signalMatchEnd();
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, secondsRemaining, matchDuration, readOnly]);

  // ---------------------------------------------------------------------------
  // Jogadores
  // ---------------------------------------------------------------------------
  const addPlayer = (name: string, isGoalkeeper: boolean, skill: number): string | null => {
    if (readOnly) return null;
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return null;
    const id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setState((prev) => {
      const order = prev.checkInCounter + 1;
      const newPlayer: Player = {
        id,
        name: trimmed,
        isGoalkeeper,
        skill: clampInt(skill, 1, 5, 3),
        present: true,
        checkInOrder: order,
      };
      return { ...prev, checkInCounter: order, players: [newPlayer, ...prev.players] };
    });
    return id;
  };

  const togglePresence = (playerId: string) => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        const name = patch.name !== undefined ? patch.name.trim().slice(0, 60) : p.name;
        const skill = patch.skill !== undefined ? clampInt(patch.skill, 1, 5, p.skill) : p.skill;
        return { ...p, ...patch, name: name || p.name, skill };
      }),
    }));
  };

  const removePlayer = (playerId: string) => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        playersPerTeam: clampInt(playersPerTeam, 2, 15, prev.settings.playersPerTeam),
        sortMode,
      },
    }));
  };

  const runTeamSort = () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, name: trimmed } : t)),
    }));
  };

  const setTeamColor = (teamId: string, color: string) => {
    if (readOnly) return;
    const safeColor = sanitizeHexColor(color);
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, color: safeColor } : t)),
    }));
  };

  /** Coloca (ou move) um jogador em um time específico sem refazer o sorteio. */
  const addPlayerToTeam = (playerId: string, teamId: string) => {
    if (readOnly) return;
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
          return t.id === teamId
            ? { ...t, playerIds: [...without, playerId] }
            : { ...t, playerIds: without };
        }),
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Partida
  // ---------------------------------------------------------------------------
  const toggleTimer = () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    setState((prev) => ({
      ...prev,
      activeMatch: {
        ...prev.activeMatch,
        secondsRemaining: Math.min(7200, prev.activeMatch.secondsRemaining + 60),
      },
    }));
  };

  const setMatchDurationMinutes = (minutes: number) => {
    if (readOnly) return;
    const seconds = clampInt(minutes * 60, 60, 3600, DEFAULT_STATE.settings.matchDurationSeconds);
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    setState((prev) => ({
      ...prev,
      history: [],
      activeMatch: clearedActiveMatch(prev),
    }));
  };

  /** Soma os números do dia ao acumulado histórico e zera o dia. */
  const archiveDay = () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    authExpired,
    linkRevoked,
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
