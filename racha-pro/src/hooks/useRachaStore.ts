import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { MOCK_PLAYERS } from '../data/mockPlayers';
import { supabase } from '../lib/supabase';
import {
  AllTimePlayerStats,
  GoalEvent,
  MatchRecord,
  Player,
  RachaRole,
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
import { computeStatsFromHistory, isSafeObjectKey, mergeStats } from '../utils/stats';
import { generateTeams } from '../utils/teamBalancer';
import { useWakeLock } from './useWakeLock';

const PUSH_DEBOUNCE_MS = 600;
const RETRY_INTERVAL_MS = 15000;
const VIEWER_BROADCAST_COOLDOWN_MS = 2500;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

const MAX_PLAYERS = 200;
const MAX_TEAMS = 32;
const MAX_EVENTS_PER_MATCH = 200;
const MAX_HISTORY = 500;
const MAX_ALL_TIME_ENTRIES = 500;

interface RemoteRow {
  id: string;
  data: unknown;
  version?: number;
}

export interface UseRachaStoreOptions {
  rachaId: string;
  shareCode: string;
  userId?: string | null;
  initialData?: unknown;
  initialVersion?: number | null;
  role?: RachaRole;
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

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function safeStr(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLen);
}

function safeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_ID_RE.test(trimmed) || !isSafeObjectKey(trimmed)) return null;
  return trimmed;
}

function sanitizeHexColor(value: unknown): string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value) ? value : '#34d399';
}

function sanitizePlayers(raw: unknown): Player[] {
  if (!Array.isArray(raw)) return [];
  const out: Player[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_PLAYERS) break;
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Partial<Player>;
    const id = safeId(p.id);
    const name = safeStr(p.name, 60).trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
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
    if (out.length >= MAX_TEAMS) break;
    if (typeof item !== 'object' || item === null) continue;
    const t = item as Partial<Team>;
    const id = safeId(t.id);
    const name = safeStr(t.name, 40).trim();
    if (!id || !name) continue;
    const playerIds = Array.isArray(t.playerIds)
      ? t.playerIds
          .map((pid) => safeId(pid))
          .filter((pid): pid is string => pid !== null)
          .slice(0, MAX_PLAYERS)
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
    if (out.length >= MAX_EVENTS_PER_MATCH) break;
    if (typeof item !== 'object' || item === null) continue;
    const e = item as Partial<GoalEvent>;
    const id = safeId(e.id);
    const teamId = safeId(e.teamId);
    const scorerId = e.scorerId === 'own_goal' ? 'own_goal' : safeId(e.scorerId);
    if (!id || !teamId || !scorerId) continue;
    const assistId = e.assistId ? safeId(e.assistId) : null;
    out.push({
      id,
      teamId,
      scorerId,
      assistId,
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
    if (out.length >= MAX_HISTORY) break;
    if (typeof item !== 'object' || item === null) continue;
    const m = item as Partial<MatchRecord>;
    const id = safeId(m.id);
    if (!id) continue;
    out.push({
      id,
      teamAName: safeStr(m.teamAName, 40, 'Time A'),
      teamBName: safeStr(m.teamBName, 40, 'Time B'),
      scoreA: clampInt(m.scoreA, 0, 999, 0),
      scoreB: clampInt(m.scoreB, 0, 999, 0),
      events: sanitizeEvents(m.events),
      finishedAt: safeStr(m.finishedAt, 20, ''),
      teamAId: safeId(m.teamAId) ?? undefined,
      teamBId: safeId(m.teamBId) ?? undefined,
      teamAPlayerIds: Array.isArray(m.teamAPlayerIds)
        ? m.teamAPlayerIds
            .map((pid) => safeId(pid))
            .filter((pid): pid is string => pid !== null)
            .slice(0, MAX_PLAYERS)
        : undefined,
      teamBPlayerIds: Array.isArray(m.teamBPlayerIds)
        ? m.teamBPlayerIds
            .map((pid) => safeId(pid))
            .filter((pid): pid is string => pid !== null)
            .slice(0, MAX_PLAYERS)
        : undefined,
      goalkeeperAId:
        m.goalkeeperAId === null ? null : safeId(m.goalkeeperAId) ?? undefined,
      goalkeeperBId:
        m.goalkeeperBId === null ? null : safeId(m.goalkeeperBId) ?? undefined,
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
  const out = Object.create(null) as Record<string, AllTimePlayerStats>;
  let count = 0;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_ALL_TIME_ENTRIES) break;
    const validKey = safeId(key);
    if (!validKey) continue;
    if (typeof val !== 'object' || val === null) continue;
    const s = val as Partial<AllTimePlayerStats>;
    out[validKey] = {
      name: safeStr(s.name, 60, 'Jogador'),
      goals: clampInt(s.goals, 0, 100000, 0),
      assists: clampInt(s.assists, 0, 100000, 0),
      wins: clampInt(s.wins, 0, 100000, 0),
      draws: typeof s.draws === 'number' ? clampInt(s.draws, 0, 100000, 0) : undefined,
      losses: typeof s.losses === 'number' ? clampInt(s.losses, 0, 100000, 0) : undefined,
      matches: clampInt(s.matches, 0, 100000, 0),
      gkMatches: clampInt(s.gkMatches, 0, 100000, 0),
      cleanSheets: clampInt(s.cleanSheets, 0, 100000, 0),
      goalsConceded: clampInt(s.goalsConceded, 0, 100000, 0),
    };
    count += 1;
  }
  return out;
}

/** Valida e sanitiza qualquer dado vindo do localStorage ou da nuvem (protege contra JSONB malformado e prototype pollution). */
export function normalizeState(raw: unknown): RachaStoreState {
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
      teamAId: safeId(rawMatch.teamAId),
      teamBId: safeId(rawMatch.teamBId),
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

/**
 * Mescla jogadores recém-adicionados no servidor (ex.: via join_racha_by_invite_code)
 * ao estado local do admin em caso de conflito de versão, evitando lost updates.
 */
export function mergeServerAddedPlayers(
  local: RachaStoreState,
  serverRaw: unknown,
  explicitlyRemovedIds: Set<string>
): RachaStoreState {
  const server = normalizeState(serverRaw);
  const localIds = new Set(local.players.map((p) => p.id));
  const newlyJoined = server.players.filter(
    (p) => !localIds.has(p.id) && !explicitlyRemovedIds.has(p.id)
  );
  if (newlyJoined.length === 0) return local;
  return {
    ...local,
    players: [...newlyJoined, ...local.players].slice(0, MAX_PLAYERS),
  };
}

function storageKeyOf(rachaId: string, userId?: string | null): string {
  return userId ? `rachapro_racha_${userId}_${rachaId}` : `rachapro_racha_${rachaId}`;
}

function dirtyKeyOf(rachaId: string, userId?: string | null): string {
  return userId ? `rachapro_dirty_${userId}_${rachaId}` : `rachapro_dirty_${rachaId}`;
}

function readDirty(rachaId: string, userId?: string | null): boolean {
  try {
    return localStorage.getItem(dirtyKeyOf(rachaId, userId)) === '1';
  } catch {
    return false;
  }
}

function writeDirty(rachaId: string, value: boolean, userId?: string | null): void {
  try {
    if (value) localStorage.setItem(dirtyKeyOf(rachaId, userId), '1');
    else localStorage.removeItem(dirtyKeyOf(rachaId, userId));
  } catch {
    // ignora
  }
}

function isSessionExpiredError(err: unknown): boolean {
  const obj = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: string;
    status?: number;
    message?: string;
  };
  const code = obj.code ?? '';
  const msg = (obj.message ?? '').toLowerCase();
  return code === 'PGRST301' || obj.status === 401 || msg.includes('jwt');
}

function isMissingRpcError(err: unknown): boolean {
  const obj = (typeof err === 'object' && err !== null ? err : {}) as { code?: string };
  return obj.code === '42883' || obj.code === 'PGRST202';
}

function loadInitialState(
  rachaId: string,
  userId: string | null | undefined,
  initialData: unknown,
  isReadOnly: boolean
): RachaStoreState {
  if (!isReadOnly && readDirty(rachaId, userId)) {
    try {
      const raw = localStorage.getItem(storageKeyOf(rachaId, userId));
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

  if (!isReadOnly) {
    try {
      const raw = localStorage.getItem(storageKeyOf(rachaId, userId));
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
  userId = null,
  initialData,
  initialVersion = null,
  role,
  readOnly,
}: UseRachaStoreOptions) {
  // Fail-closed: assume 'viewer' se role não for explicitamente 'admin' ou 'member'
  const effectiveRole: RachaRole =
    role === 'admin' || role === 'member' || role === 'viewer'
      ? role
      : readOnly === false
      ? 'admin'
      : 'viewer';
  const isReadOnly = effectiveRole !== 'admin';
  const isViewer = effectiveRole === 'viewer';

  const [state, setState] = useState<RachaStoreState>(() =>
    loadInitialState(rachaId, userId, initialData, isReadOnly)
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    if (!supabase) return 'offline';
    return navigator.onLine ? (isReadOnly ? 'synced' : 'saving') : 'offline';
  });
  const [cloudReady, setCloudReady] = useState(false);
  const [remoteUpdateTick, setRemoteUpdateTick] = useState(0);
  const [authExpired, setAuthExpired] = useState(false);
  const [linkRevoked, setLinkRevoked] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const authExpiredRef = useRef(authExpired);
  authExpiredRef.current = authExpired;
  const versionRef = useRef<number | null>(
    typeof initialVersion === 'number' && Number.isFinite(initialVersion) ? initialVersion : null
  );
  const removedPlayerIdsRef = useRef<Set<string>>(new Set());
  const lastSyncedKeyRef = useRef<string | null>(
    isNonEmptyObject(initialData) && (isReadOnly || !readDirty(rachaId, userId))
      ? syncKey(normalizeState(initialData))
      : null
  );
  const cloudReadyRef = useRef(false);
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const syncSeqRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const lastBroadcastSyncAtRef = useRef(0);

  const currentKey = useMemo(() => syncKey(state), [state]);

  useWakeLock(!isReadOnly && state.activeMatch.isRunning);

  // ---------------------------------------------------------------------------
  // Nuvem: leitura (admin/membro via tabela protegida por RLS; visitante via RPC segura)
  // ---------------------------------------------------------------------------
  const syncFromCloud = useCallback(
    async (notifyIfChanged = false): Promise<void> => {
      if (!supabase || !rachaId) return;
      const seq = ++syncSeqRef.current;
      syncInFlightRef.current = true;
      try {
        let cloud: unknown = null;

        if (isViewer) {
          const { data, error } = await supabase.rpc('get_racha_by_share_code', {
            p_share_code: shareCode.trim().toLowerCase(),
          });
          if (seq !== syncSeqRef.current) return;
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
            .select('data, version')
            .eq('id', rachaId)
            .maybeSingle();
          if (seq !== syncSeqRef.current) return;
          if (error) {
            // Fallback se coluna version ainda não existir
            if (error.code === '42703') {
              const fb = await supabase
                .from('rachas')
                .select('data')
                .eq('id', rachaId)
                .maybeSingle();
              if (seq !== syncSeqRef.current) return;
              if (fb.error) throw fb.error;
              cloud = fb.data?.data;
            } else {
              throw error;
            }
          } else {
            cloud = data?.data;
            if (typeof (data as { version?: unknown } | null)?.version === 'number') {
              versionRef.current = (data as { version: number }).version;
            }
          }
        }

        const hasUnsynced = isReadOnly
          ? false
          : cloudReadyRef.current
          ? syncKey(stateRef.current) !== lastSyncedKeyRef.current
          : readDirty(rachaId, userId);

        if (isNonEmptyObject(cloud) && !hasUnsynced) {
          const next = applyRemote(stateRef.current, cloud);
          const nextKey = syncKey(next);
          lastSyncedKeyRef.current = nextKey;
          if (nextKey !== syncKey(stateRef.current)) {
            setState(next);
            if (notifyIfChanged) setRemoteUpdateTick((t) => t + 1);
          }
          setSyncStatus('synced');
        } else if (isNonEmptyObject(cloud) && hasUnsynced) {
          // Mesmo com alterações locais pendentes, preserva jogadores recém-entrados no servidor
          const merged = mergeServerAddedPlayers(
            stateRef.current,
            cloud,
            removedPlayerIdsRef.current
          );
          if (merged !== stateRef.current) {
            setState(merged);
          }
        } else if (!hasUnsynced) {
          lastSyncedKeyRef.current = syncKey(stateRef.current);
          setSyncStatus('synced');
        }

        setAuthExpired(false);
        cloudReadyRef.current = true;
        setCloudReady(true);
      } catch (err) {
        if (!isViewer && isSessionExpiredError(err)) {
          setAuthExpired(true);
        }
        setSyncStatus('offline');
      } finally {
        if (seq === syncSeqRef.current) {
          syncInFlightRef.current = false;
        }
      }
    },
    [rachaId, userId, isReadOnly, isViewer, shareCode]
  );

  useEffect(() => {
    void syncFromCloud(false);
  }, [syncFromCloud]);

  // ---------------------------------------------------------------------------
  // Nuvem: escrita atômica com optimistic locking (CAS via save_racha_data)
  // ---------------------------------------------------------------------------
  const pushToCloud = useCallback(async (): Promise<void> => {
    if (!supabase || !rachaId || isReadOnly || authExpiredRef.current) return;
    let snapshot = stateRef.current;
    let snapshotKey = syncKey(snapshot);

    if (snapshotKey === lastSyncedKeyRef.current) {
      writeDirty(rachaId, false, userId);
      setSyncStatus('synced');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    try {
      let saved = false;

      // Até 2 tentativas em caso de conflito de versão (ex.: membro entrou durante debounce)
      for (let attempt = 0; attempt < 2; attempt++) {
        const rpcRes = await supabase.rpc('save_racha_data', {
          p_racha_id: rachaId,
          p_expected_version: versionRef.current,
          p_data: toCloudPayload(snapshot),
        });

        if (rpcRes.error) {
          if (isMissingRpcError(rpcRes.error)) {
            // Fallback compatível antes de executar supabase/security_hardening.sql
            const { error } = await supabase
              .from('rachas')
              .update({
                data: toCloudPayload(snapshot),
                updated_at: new Date().toISOString(),
              })
              .eq('id', rachaId);
            if (error) throw error;
            saved = true;
            break;
          }
          throw rpcRes.error;
        }

        const row = (Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data) as {
          ok?: boolean;
          conflict?: boolean;
          version?: number;
          data?: unknown;
        } | null;

        if (row?.conflict) {
          if (typeof row.version === 'number') versionRef.current = row.version;
          const merged = mergeServerAddedPlayers(
            stateRef.current,
            row.data,
            removedPlayerIdsRef.current
          );
          if (merged !== stateRef.current) {
            stateRef.current = merged;
            setState(merged);
          }
          snapshot = merged;
          snapshotKey = syncKey(snapshot);
          continue;
        }

        if (typeof row?.version === 'number') {
          versionRef.current = row.version;
        }
        saved = true;
        break;
      }

      if (!saved) {
        setSyncStatus('offline');
        return;
      }

      removedPlayerIdsRef.current.clear();
      setAuthExpired(false);
      lastSyncedKeyRef.current = snapshotKey;
      if (syncKey(stateRef.current) === snapshotKey) {
        writeDirty(rachaId, false, userId);
        setSyncStatus('synced');
      } else {
        setSyncStatus('saving');
      }

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
      if (isSessionExpiredError(err)) {
        setAuthExpired(true);
      }
      setSyncStatus('offline');
    }
  }, [rachaId, userId, isReadOnly]);

  // Salva no localStorage namespaced por userId (somente admin e sessão ativa)
  useEffect(() => {
    if (isReadOnly || !rachaId || !userId || authExpired) return;
    try {
      localStorage.setItem(storageKeyOf(rachaId, userId), JSON.stringify(state));
    } catch {
      // ignora
    }
  }, [state, rachaId, userId, isReadOnly, authExpired]);

  useEffect(() => {
    if (!supabase || !cloudReady || isReadOnly || !rachaId || authExpired) return;
    if (currentKey === lastSyncedKeyRef.current) return;

    writeDirty(rachaId, true, userId);
    setSyncStatus(navigator.onLine ? 'saving' : 'offline');

    const timeout = window.setTimeout(() => {
      void pushToCloud();
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [currentKey, cloudReady, pushToCloud, isReadOnly, rachaId, userId, authExpired]);

  const pushRef = useRef(pushToCloud);
  pushRef.current = pushToCloud;
  useEffect(() => {
    return () => {
      if (
        !isReadOnly &&
        !authExpiredRef.current &&
        cloudReadyRef.current &&
        syncKey(stateRef.current) !== lastSyncedKeyRef.current
      ) {
        void pushRef.current();
      }
    };
  }, [isReadOnly]);

  const retrySync = useCallback((): void => {
    if (!supabase) return;
    if (isReadOnly) void syncFromCloud(true);
    else if (!cloudReadyRef.current) void syncFromCloud(false);
    else void pushToCloud();
  }, [pushToCloud, syncFromCloud, isReadOnly]);

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
  // - Admin e Membro: postgres_changes protegido por RLS
  // - Visitante: broadcast com throttle + guarda single in-flight (anti-DoS)
  // - Membro NÃO se inscreve em racha_live_<shareCode>
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase || !rachaId || !shareCode) return;
    const client = supabase;

    let liveChannel: RealtimeChannel | null = null;
    let viewerCooldownTimer: number | null = null;

    if (effectiveRole === 'admin' || isViewer) {
      liveChannel = client.channel(`racha_live_${shareCode.toLowerCase()}`);
      if (isViewer) {
        const handleBroadcast = () => {
          const now = Date.now();
          const elapsed = now - lastBroadcastSyncAtRef.current;
          if (syncInFlightRef.current || elapsed < VIEWER_BROADCAST_COOLDOWN_MS) {
            if (viewerCooldownTimer === null) {
              const wait = Math.max(400, VIEWER_BROADCAST_COOLDOWN_MS - elapsed);
              viewerCooldownTimer = window.setTimeout(() => {
                viewerCooldownTimer = null;
                lastBroadcastSyncAtRef.current = Date.now();
                void syncFromCloud(true);
              }, wait);
            }
            return;
          }
          lastBroadcastSyncAtRef.current = now;
          void syncFromCloud(true);
        };

        liveChannel.on('broadcast', { event: 'state_updated' }, handleBroadcast);
      }
      liveChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && isViewer && cloudReadyRef.current) {
          void syncFromCloud(true);
        }
      });
      if (effectiveRole === 'admin') {
        broadcastChannelRef.current = liveChannel;
      }
    }

    let rachaChangesChannel: RealtimeChannel | null = null;
    if (!isViewer) {
      rachaChangesChannel = client
        .channel(`racha_changes_${rachaId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rachas', filter: `id=eq.${rachaId}` },
          (payload: RealtimePostgresChangesPayload<RemoteRow>) => {
            if (payload.eventType === 'DELETE') return;
            const remoteData: unknown = payload.new.data;
            if (!isNonEmptyObject(remoteData)) return;
            if (typeof payload.new.version === 'number') {
              versionRef.current = payload.new.version;
            }

            const local = stateRef.current;
            if (
              !isReadOnly &&
              cloudReadyRef.current &&
              syncKey(local) !== lastSyncedKeyRef.current
            ) {
              // Preserva novos jogadores vindos do servidor mesmo com estado local sujo
              const merged = mergeServerAddedPlayers(
                local,
                remoteData,
                removedPlayerIdsRef.current
              );
              if (merged !== local) setState(merged);
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
      if (viewerCooldownTimer !== null) window.clearTimeout(viewerCooldownTimer);
      broadcastChannelRef.current = null;
      if (liveChannel) void client.removeChannel(liveChannel);
      if (rachaChangesChannel) void client.removeChannel(rachaChangesChannel);
    };
  }, [rachaId, shareCode, effectiveRole, isReadOnly, isViewer, syncFromCloud]);

  // ---------------------------------------------------------------------------
  // Cronômetro
  // ---------------------------------------------------------------------------
  const { isRunning, secondsRemaining } = state.activeMatch;
  const matchDuration = state.settings.matchDurationSeconds;

  useEffect(() => {
    if (isReadOnly || !isRunning) return;
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
  }, [isRunning, isReadOnly]);

  const wasRunningRef = useRef(false);
  const warnedRef = useRef(false);
  useEffect(() => {
    if (isReadOnly) return;
    if (secondsRemaining > 60) warnedRef.current = false;

    if (isRunning && secondsRemaining === 60 && matchDuration > 60 && !warnedRef.current) {
      warnedRef.current = true;
      playOneMinuteWarning();
    }

    if (wasRunningRef.current && !isRunning && secondsRemaining === 0) {
      signalMatchEnd();
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, secondsRemaining, matchDuration, isReadOnly]);

  // ---------------------------------------------------------------------------
  // Jogadores
  // ---------------------------------------------------------------------------
  const addPlayer = (name: string, isGoalkeeper: boolean, skill: number): string | null => {
    if (isReadOnly) return null;
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return null;
    const id = makeId('player');
    setState((prev) => {
      if (prev.players.length >= MAX_PLAYERS) return prev;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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

  const applyConfirmedToPresence = (confirmedPlayerIds: string[]) => {
    if (isReadOnly || confirmedPlayerIds.length === 0) return;
    const confirmedSet = new Set(confirmedPlayerIds);
    setState((prev) => {
      let counter = prev.checkInCounter;
      let changed = false;
      const players = prev.players.map((p) => {
        if (!confirmedSet.has(p.id) || p.present) return p;
        changed = true;
        counter += 1;
        return { ...p, present: true, checkInOrder: counter };
      });
      if (!changed) return prev;
      return { ...prev, players, checkInCounter: counter };
    });
  };

  const updatePlayer = (
    playerId: string,
    patch: Partial<Pick<Player, 'name' | 'isGoalkeeper' | 'skill'>>
  ) => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    removedPlayerIdsRef.current.add(playerId);
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, name: trimmed } : t)),
    }));
  };

  const setTeamColor = (teamId: string, color: string) => {
    if (isReadOnly) return;
    const safeColor = sanitizeHexColor(color);
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, color: safeColor } : t)),
    }));
  };

  const addPlayerToTeam = (playerId: string, teamId: string) => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    setState((prev) => ({
      ...prev,
      activeMatch: {
        ...prev.activeMatch,
        secondsRemaining: Math.min(7200, prev.activeMatch.secondsRemaining + 60),
      },
    }));
  };

  const setMatchDurationMinutes = (minutes: number) => {
    if (isReadOnly) return;
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

  const setMatchup = (teamAId: string, teamBId: string) => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    setState((prev) => {
      if (prev.activeMatch.events.length >= MAX_EVENTS_PER_MATCH) return prev;
      const elapsed = Math.max(
        0,
        prev.settings.matchDurationSeconds - prev.activeMatch.secondsRemaining
      );
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');

      const newEvent: GoalEvent = {
        id: makeId('goal'),
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    setState((prev) => {
      const teamA = prev.teams.find((t) => t.id === prev.activeMatch.teamAId);
      const teamB = prev.teams.find((t) => t.id === prev.activeMatch.teamBId);
      if (!teamA || !teamB) return prev;

      const record: MatchRecord = {
        id: makeId('match'),
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
        history: [record, ...prev.history].slice(0, MAX_HISTORY),
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

  const resetDayStats = () => {
    if (isReadOnly) return;
    setState((prev) => ({
      ...prev,
      history: [],
      activeMatch: clearedActiveMatch(prev),
    }));
  };

  const archiveDay = () => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    applyConfirmedToPresence,
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
