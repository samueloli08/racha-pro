import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RachaRecord, RachaStoreState } from '../types/racha';

const SHARE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const SHARE_CODE_REGEX = /^[a-z0-9]{6,32}$/;
const LEGACY_STORAGE_KEY = 'rachapro_state_v1';

function generateShareCode(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  }
  return out;
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
  if (code === '42501' || obj.status === 403) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (code === '23514') {
    return 'Os dados informados excedem o limite permitido.';
  }
  if (code === '42883' || code === 'PGRST202' || code === '42P01') {
    return 'Banco de dados desatualizado. Execute o script supabase/auth_rachas.sql no Supabase.';
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

function lastRachaStorageKey(userId: string): string {
  return `rachapro_last_racha_${userId}`;
}

export function useOwnedRachas(userId: string | null) {
  const [rachas, setRachas] = useState<RachaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRachas = useCallback(async () => {
    if (!supabase || !userId) {
      setRachas([]);
      setSelectedId(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('rachas')
        .select('id, owner_id, name, share_code, is_public, data, created_at, updated_at')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false });

      if (queryError) throw queryError;
      const list = (data ?? []) as RachaRecord[];
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
        const { data, error: insertError } = await supabase
          .from('rachas')
          .insert({
            owner_id: userId,
            name: trimmed,
            share_code: shareCode,
            is_public: true,
            data: initialData ?? {},
          })
          .select('id, owner_id, name, share_code, is_public, data, created_at, updated_at')
          .single();

        if (!insertError && data) {
          const created = data as RachaRecord;
          setRachas((prev) => [created, ...prev]);
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
    [userId, selectRacha]
  );

  const renameRacha = useCallback(
    async (id: string, name: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: 'Sessão inválida.' };
      const trimmed = name.trim().slice(0, 48);
      if (!trimmed) return { error: 'Nome inválido.' };

      const { error: updateError } = await supabase
        .from('rachas')
        .update({ name: trimmed })
        .eq('id', id)
        .eq('owner_id', userId);

      if (updateError) {
        return { error: sanitizeDbError(updateError, 'Não foi possível renomear o racha.') };
      }
      setRachas((prev) => prev.map((r) => (r.id === id ? { ...r, name: trimmed } : r)));
      return { error: null };
    },
    [userId]
  );

  const setRachaPublic = useCallback(
    async (id: string, isPublic: boolean): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: 'Sessão inválida.' };

      const { error: updateError } = await supabase
        .from('rachas')
        .update({ is_public: isPublic })
        .eq('id', id)
        .eq('owner_id', userId);

      if (updateError) {
        return {
          error: sanitizeDbError(updateError, 'Não foi possível alterar a privacidade do link.'),
        };
      }
      setRachas((prev) => prev.map((r) => (r.id === id ? { ...r, is_public: isPublic } : r)));
      return { error: null };
    },
    [userId]
  );

  const regenerateShareCode = useCallback(
    async (id: string): Promise<{ shareCode: string | null; error: string | null }> => {
      if (!supabase || !userId) return { shareCode: null, error: 'Sessão inválida.' };

      for (let attempt = 0; attempt < 3; attempt++) {
        const nextCode = generateShareCode(12);
        const { error: updateError } = await supabase
          .from('rachas')
          .update({ share_code: nextCode })
          .eq('id', id)
          .eq('owner_id', userId);

        if (!updateError) {
          setRachas((prev) =>
            prev.map((r) => (r.id === id ? { ...r, share_code: nextCode } : r))
          );
          return { shareCode: nextCode, error: null };
        }
        if (updateError.code === '23505') continue;
        return {
          shareCode: null,
          error: sanitizeDbError(updateError, 'Não foi possível gerar um novo link.'),
        };
      }

      return { shareCode: null, error: 'Não foi possível gerar um novo link. Tente novamente.' };
    },
    [userId]
  );

  const deleteRacha = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: 'Sessão inválida.' };
      const { error: deleteError } = await supabase
        .from('rachas')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId);

      if (deleteError) {
        return { error: sanitizeDbError(deleteError, 'Não foi possível excluir o racha.') };
      }

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
        localStorage.removeItem(`rachapro_racha_${id}`);
        localStorage.removeItem(`rachapro_dirty_${id}`);
      } catch {
        // ignora
      }
      return { error: null };
    },
    [userId, selectedId]
  );

  const selectedRacha = rachas.find((r) => r.id === selectedId) ?? null;

  return {
    rachas,
    selectedRacha,
    loading,
    error,
    reload: loadRachas,
    selectRacha,
    createRacha,
    renameRacha,
    setRachaPublic,
    regenerateShareCode,
    deleteRacha,
  };
}

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
