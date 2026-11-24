import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RachaRecord, RachaStoreState } from '../types/racha';
import { isValidInviteCode, normalizeInviteCode } from '../utils/inviteCode';

const SHARE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 caracteres [a-z0-9]
const SHARE_CODE_REGEX = /^[a-z0-9]{6,32}$/;
const LEGACY_STORAGE_KEY = 'rachapro_state_v1';

/** Gera share_code usando rejection sampling (zero viés de módulo). */
function generateShareCode(length = 12): string {
  const maxValid = Math.floor(256 / SHARE_ALPHABET.length) * SHARE_ALPHABET.length; // 248
  let out = '';
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      if (buf[i] < maxValid) {
        out += SHARE_ALPHABET[buf[i] % SHARE_ALPHABET.length];
      }
    }
  }
  return out;
}

function isMissingMigrationError(err: unknown): boolean {
  const obj = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: string;
  };
  const code = obj.code ?? '';
  return code === '42883' || code === 'PGRST202' || code === '42P01' || code === '42703';
}

export function translateInviteJoinError(err: unknown): string {
  const obj = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: string;
    message?: string;
  };
  const msg = (obj.message ?? '').toUpperCase();

  if (msg.includes('INVALID_CODE')) {
    return 'Código de convite inválido ou expirado. Confira com o organizador.';
  }
  if (msg.includes('ALREADY_MEMBER')) {
    return 'Você já participa deste racha.';
  }
  if (msg.includes('RATE_LIMITED')) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
  }
  if (msg.includes('RACHA_FULL')) {
    return 'Este racha atingiu o limite máximo de participantes.';
  }
  if (msg.includes('UNAUTHORIZED')) {
    return 'Faça login para entrar em um racha.';
  }
  if (isMissingMigrationError(err)) {
    return import.meta.env.DEV
      ? 'Execute supabase/members_sessions.sql e supabase/security_hardening.sql no Supabase.'
      : 'Serviço de convites temporariamente indisponível.';
  }
  return sanitizeDbError(err, 'Não foi possível entrar no racha com este código.');
}

function sanitizeDbError(err: unknown, fallback: string): string {
  if (import.meta.env.DEV) {
    console.warn('[rachas] erro:', err);
  }
  const obj = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: string;
    message?: string;
    status?: number;
  };
  const code = obj.code ?? '';
  const msg = (obj.message ?? '').toLowerCase();

  if (code === 'PGRST301' || obj.status === 401 || msg.includes('jwt')) {
    return 'Sua sessão expirou. Faça login novamente.';
  }
  if (code === '42501' || obj.status === 403 || msg.includes('forbidden')) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (code === '23514') {
    return 'Os dados informados excedem o limite permitido.';
  }
  if (code === '42883' || code === 'PGRST202' || code === '42P01') {
    return import.meta.env.DEV
      ? 'Banco de dados desatualizado. Execute os scripts SQL em supabase/ no Supabase.'
      : 'Serviço temporariamente indisponível. Tente novamente em instantes.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Sem conexão com o servidor. Verifique sua internet.';
  }
  return fallback;
}

export function isValidShareCode(code: string): boolean {
  return SHARE_CODE_REGEX.test(code.trim().toLowerCase());
}

export function buildShareUrl(shareCode: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('racha', shareCode);
  return url.toString();
}

export function getShareCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('racha')?.trim().toLowerCase();
  return raw || null;
}

export function clearShareCodeFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('racha')) return;
  url.searchParams.delete('racha');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function setShareCodeInUrl(shareCode: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('racha', shareCode);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function readLegacyLocalState(): Partial<RachaStoreState> | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RachaStoreState>;
    const hasPlayers = Array.isArray(parsed?.players) && parsed.players.length > 0;
    const hasHistory = Array.isArray(parsed?.history) && parsed.history.length > 0;
    const hasAllTime =
      typeof parsed?.allTimeStats === 'object' &&
      parsed.allTimeStats !== null &&
      Object.keys(parsed.allTimeStats).length > 0;
    return hasPlayers || hasHistory || hasAllTime ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLegacyLocalState(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignora
  }
}

function lastRachaStorageKey(userId: string): string {
  return `rachapro_last_racha_${userId}`;
}

export function useUserRachas(userId: string | null) {
  const [rachas, setRachas] = useState<RachaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const selectRacha = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (userId) {
        try {
          localStorage.setItem(lastRachaStorageKey(userId), id);
        } catch {
          // ignora
        }
      }
    },
    [userId]
  );

  const loadRachas = useCallback(async () => {
    if (!supabase || !userId) {
      setRachas([]);
      setSelectedId(null);
      setLoading(false);
      setError(null);
      setMigrationNeeded(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let list: RachaRecord[] = [];
      const rpcRes = await supabase.rpc('get_my_rachas');

      if (!rpcRes.error && Array.isArray(rpcRes.data)) {
        setMigrationNeeded(false);
        list = (rpcRes.data as RachaRecord[])
          .filter((row) => row.my_role === 'admin' || row.my_role === 'member')
          .map((row) => ({
            ...row,
            my_role: row.my_role === 'admin' ? 'admin' : 'member',
          }));
      } else if (rpcRes.error && isMissingMigrationError(rpcRes.error)) {
        setMigrationNeeded(true);
        const { data, error: queryError } = await supabase
          .from('rachas')
          .select('id, owner_id, name, share_code, is_public, data, created_at, updated_at')
          .eq('owner_id', userId)
          .order('updated_at', { ascending: false });

        if (queryError) throw queryError;
        list = ((data ?? []) as RachaRecord[]).map((row) => ({
          ...row,
          my_role: 'admin',
        }));
      } else if (rpcRes.error) {
        throw rpcRes.error;
      }

      setRachas(list);

      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        try {
          const saved = localStorage.getItem(lastRachaStorageKey(userId));
          if (saved && list.some((r) => r.id === saved)) return saved;
        } catch {
          // ignora
        }
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(sanitizeDbError(err, 'Não foi possível carregar seus rachas.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadRachas();
  }, [loadRachas]);

  const isOwnedAdmin = useCallback(
    (id: string) => rachas.some((r) => r.id === id && r.my_role === 'admin'),
    [rachas]
  );

  const createRacha = useCallback(
    async (
      name: string,
      initialData?: Partial<RachaStoreState> | null
    ): Promise<{ racha: RachaRecord | null; error: string | null }> => {
      if (!supabase || !userId) return { racha: null, error: 'Faça login para criar um racha.' };
      const trimmed = name.trim().slice(0, 48);
      if (!trimmed) return { racha: null, error: 'Dê um nome para o racha.' };

      for (let attempt = 0; attempt < 3; attempt++) {
        const shareCode = generateShareCode(12);
        const payload = {
          owner_id: userId,
          name: trimmed,
          share_code: shareCode,
          is_public: true,
          data: initialData ?? {},
        };

        const { data, error: insertError } = await supabase
          .from('rachas')
          .insert(payload)
          .select('id, owner_id, name, share_code, is_public, data, created_at, updated_at')
          .single();

        if (!insertError && data) {
          if (initialData) clearLegacyLocalState();
          const created: RachaRecord = {
            ...(data as RachaRecord),
            my_role: 'admin',
          };
          // Recarrega via get_my_rachas para obter invite_code (de racha_invites) e version
          await loadRachas();
          selectRacha(created.id);
          return { racha: created, error: null };
        }

        if (insertError?.code === '23505') continue;
        return {
          racha: null,
          error: sanitizeDbError(insertError, 'Não foi possível criar o racha.'),
        };
      }

      return { racha: null, error: 'Não foi possível gerar um código único. Tente novamente.' };
    },
    [userId, selectRacha, loadRachas]
  );

  const joinByInviteCode = useCallback(
    async (
      rawCode: string,
      displayName?: string
    ): Promise<{
      rachaId: string | null;
      rachaName: string | null;
      linkedExisting: boolean;
      error: string | null;
    }> => {
      if (!supabase || !userId) {
        return {
          rachaId: null,
          rachaName: null,
          linkedExisting: false,
          error: 'Faça login para entrar em um racha.',
        };
      }

      const normalized = normalizeInviteCode(rawCode);
      if (!isValidInviteCode(normalized)) {
        return {
          rachaId: null,
          rachaName: null,
          linkedExisting: false,
          error: 'Código inválido. Use o código curto enviado pelo organizador (ex.: RCH4K92X7).',
        };
      }

      const { data, error: rpcError } = await supabase.rpc('join_racha_by_invite_code', {
        p_invite_code: normalized,
        p_display_name: displayName?.trim() ? displayName.trim().slice(0, 60) : null,
      });

      if (rpcError) {
        return {
          rachaId: null,
          rachaName: null,
          linkedExisting: false,
          error: translateInviteJoinError(rpcError),
        };
      }

      const row = (Array.isArray(data) ? data[0] : data) as {
        ok?: boolean;
        error_code?: string | null;
        racha_id?: string | null;
        racha_name?: string | null;
        linked_existing?: boolean;
      } | null;

      // Suporte ao retorno estruturado da migration endurecida (sem rollback no rate limit)
      if (row && row.ok === false) {
        return {
          rachaId: null,
          rachaName: null,
          linkedExisting: false,
          error: translateInviteJoinError({ message: row.error_code ?? 'INVALID_CODE' }),
        };
      }

      await loadRachas();
      if (row?.racha_id) {
        selectRacha(row.racha_id);
      }

      return {
        rachaId: row?.racha_id ?? null,
        rachaName: row?.racha_name ?? null,
        linkedExisting: Boolean(row?.linked_existing),
        error: null,
      };
    },
    [userId, loadRachas, selectRacha]
  );

  const regenerateInviteCode = useCallback(
    async (id: string): Promise<{ inviteCode: string | null; error: string | null }> => {
      if (!supabase || !userId || !isOwnedAdmin(id)) {
        return { inviteCode: null, error: 'Você não tem permissão para alterar o convite.' };
      }

      const { data, error: rpcError } = await supabase.rpc('regenerate_invite_code', {
        p_racha_id: id,
      });

      if (rpcError || typeof data !== 'string') {
        return {
          inviteCode: null,
          error: sanitizeDbError(rpcError, 'Não foi possível gerar novo código de convite.'),
        };
      }

      setRachas((prev) => prev.map((r) => (r.id === id ? { ...r, invite_code: data } : r)));
      return { inviteCode: data, error: null };
    },
    [userId, isOwnedAdmin]
  );

  const renameRacha = useCallback(
    async (id: string, name: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId || !isOwnedAdmin(id)) {
        return { error: 'Você não tem permissão para renomear este racha.' };
      }
      const trimmed = name.trim().slice(0, 48);
      if (!trimmed) return { error: 'Nome inválido.' };

      const { data, error: updateError } = await supabase
        .from('rachas')
        .update({ name: trimmed })
        .eq('id', id)
        .eq('owner_id', userId)
        .select('id')
        .maybeSingle();

      if (updateError) {
        return { error: sanitizeDbError(updateError, 'Não foi possível renomear o racha.') };
      }
      if (!data) return { error: 'Racha não encontrado ou sem permissão.' };
      setRachas((prev) => prev.map((r) => (r.id === id ? { ...r, name: trimmed } : r)));
      return { error: null };
    },
    [userId, isOwnedAdmin]
  );

  const setRachaPublic = useCallback(
    async (id: string, isPublic: boolean): Promise<{ error: string | null }> => {
      if (!supabase || !userId || !isOwnedAdmin(id)) {
        return { error: 'Você não tem permissão para alterar este racha.' };
      }

      const { data, error: updateError } = await supabase
        .from('rachas')
        .update({ is_public: isPublic })
        .eq('id', id)
        .eq('owner_id', userId)
        .select('id')
        .maybeSingle();

      if (updateError) {
        return {
          error: sanitizeDbError(updateError, 'Não foi possível alterar a privacidade do link.'),
        };
      }
      if (!data) return { error: 'Racha não encontrado ou sem permissão.' };
      setRachas((prev) => prev.map((r) => (r.id === id ? { ...r, is_public: isPublic } : r)));
      return { error: null };
    },
    [userId, isOwnedAdmin]
  );

  const regenerateShareCode = useCallback(
    async (id: string): Promise<{ shareCode: string | null; error: string | null }> => {
      if (!supabase || !userId || !isOwnedAdmin(id)) {
        return { shareCode: null, error: 'Você não tem permissão para alterar este link.' };
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const nextCode = generateShareCode(12);
        const { data, error: updateError } = await supabase
          .from('rachas')
          .update({ share_code: nextCode })
          .eq('id', id)
          .eq('owner_id', userId)
          .select('id')
          .maybeSingle();

        if (!updateError && data) {
          setRachas((prev) =>
            prev.map((r) => (r.id === id ? { ...r, share_code: nextCode } : r))
          );
          return { shareCode: nextCode, error: null };
        }
        if (updateError?.code === '23505') continue;
        return {
          shareCode: null,
          error: updateError
            ? sanitizeDbError(updateError, 'Não foi possível gerar um novo link.')
            : 'Racha não encontrado ou sem permissão.',
        };
      }

      return { shareCode: null, error: 'Não foi possível gerar um novo link. Tente novamente.' };
    },
    [userId, isOwnedAdmin]
  );

  const deleteRacha = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId || !isOwnedAdmin(id)) {
        return { error: 'Você não tem permissão para excluir este racha.' };
      }
      const { data, error: deleteError } = await supabase
        .from('rachas')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId)
        .select('id')
        .maybeSingle();

      if (deleteError) {
        return { error: sanitizeDbError(deleteError, 'Não foi possível excluir o racha.') };
      }
      if (!data) return { error: 'Racha não encontrado ou sem permissão.' };

      setRachas((prev) => {
        const remaining = prev.filter((r) => r.id !== id);
        if (selectedId === id) {
          const nextId = remaining[0]?.id ?? null;
          setSelectedId(nextId);
          try {
            if (nextId) localStorage.setItem(lastRachaStorageKey(userId), nextId);
            else localStorage.removeItem(lastRachaStorageKey(userId));
          } catch {
            // ignora
          }
        }
        return remaining;
      });
      try {
        localStorage.removeItem(`rachapro_racha_${userId}_${id}`);
        localStorage.removeItem(`rachapro_dirty_${userId}_${id}`);
        localStorage.removeItem(`rachapro_racha_${id}`);
        localStorage.removeItem(`rachapro_dirty_${id}`);
      } catch {
        // ignora
      }
      return { error: null };
    },
    [userId, selectedId, isOwnedAdmin]
  );

  const ownedRachas = useMemo(() => rachas.filter((r) => r.my_role === 'admin'), [rachas]);
  const joinedRachas = useMemo(() => rachas.filter((r) => r.my_role === 'member'), [rachas]);
  const selectedRacha = rachas.find((r) => r.id === selectedId) ?? null;

  return {
    rachas,
    ownedRachas,
    joinedRachas,
    selectedRacha,
    loading,
    error,
    migrationNeeded,
    reload: loadRachas,
    selectRacha,
    createRacha,
    joinByInviteCode,
    regenerateInviteCode,
    renameRacha,
    setRachaPublic,
    regenerateShareCode,
    deleteRacha,
  };
}

export const useOwnedRachas = useUserRachas;

export function useSharedRacha(shareCode: string | null, sessionKey: string | null = null) {
  const [racha, setRacha] = useState<RachaRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(shareCode));
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shareCode) {
      setRacha(null);
      setLoading(false);
      setNotFound(false);
      setError(null);
      return;
    }

    if (!isValidShareCode(shareCode)) {
      setRacha(null);
      setLoading(false);
      setNotFound(true);
      setError(null);
      return;
    }

    if (!supabase) {
      setLoading(false);
      setError('Serviço de nuvem não configurado.');
      return;
    }

    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_racha_by_share_code', {
        p_share_code: shareCode.trim().toLowerCase(),
      });

      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setRacha(null);
        setNotFound(true);
      } else {
        setRacha(row as RachaRecord);
      }
    } catch (err) {
      setError(sanitizeDbError(err, 'Não foi possível carregar este racha agora.'));
    } finally {
      setLoading(false);
    }
  }, [shareCode, sessionKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { racha, loading, notFound, error, reload: load };
}
