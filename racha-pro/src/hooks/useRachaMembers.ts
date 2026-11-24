import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RachaMember, RachaRole } from '../types/racha';
import { isSafeObjectKey } from '../utils/stats';

const REALTIME_DEBOUNCE_MS = 350;

function isSessionExpiredError(err: { code?: string; status?: number; message?: string }): boolean {
  const msg = (err.message ?? '').toLowerCase();
  return err.code === 'PGRST301' || err.status === 401 || msg.includes('jwt');
}

function translateMemberError(err: unknown, fallback: string): string {
  const obj = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: string;
    message?: string;
  };
  const msg = (obj.message ?? '').toUpperCase();

  if (msg.includes('FORBIDDEN')) return 'Apenas o administrador pode fazer isso.';
  if (msg.includes('PLAYER_ALREADY_LINKED')) {
    return 'Este jogador já está vinculado a outra conta.';
  }
  if (msg.includes('EMAIL_ALREADY_IN_USE')) {
    return 'Este e-mail já está associado a outro jogador neste racha.';
  }
  if (msg.includes('PLAYER_NOT_FOUND')) {
    return 'Jogador não encontrado. Aguarde a sincronização e tente novamente.';
  }
  if (msg.includes('MEMBER_NOT_FOUND')) return 'Membro não encontrado neste racha.';
  if (msg.includes('INVALID_EMAIL')) return 'Informe um endereço de e-mail válido.';
  if (obj.code === '23505') return 'Este e-mail ou jogador já está vinculado a outra conta.';
  return fallback;
}

export function useRachaMembers(
  rachaId: string,
  userId: string | null,
  role: RachaRole
) {
  const [members, setMembers] = useState<RachaMember[]>([]);
  const [playerEmails, setPlayerEmails] = useState<Record<string, string>>(
    () => Object.create(null) as Record<string, string>
  );
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [authExpired, setAuthExpired] = useState(false);

  const requestSeqRef = useRef(0);
  const enabled = Boolean(supabase && rachaId && userId && role !== 'viewer');
  const isAdmin = role === 'admin';

  const load = useCallback(async () => {
    if (!enabled || !supabase) {
      setMembers([]);
      setPlayerEmails(Object.create(null) as Record<string, string>);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('racha_members')
        .select('id, racha_id, user_id, role, player_id, display_name, joined_at, updated_at')
        .eq('racha_id', rachaId)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (seq !== requestSeqRef.current) return;

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          setAvailable(false);
        } else if (isSessionExpiredError(error)) {
          setAuthExpired(true);
        }
        return;
      }

      setAuthExpired(false);
      setAvailable(true);
      setMembers((data ?? []) as RachaMember[]);

      if (isAdmin) {
        const { data: emailRows, error: emailErr } = await supabase
          .from('racha_player_emails')
          .select('player_id, email_lower')
          .eq('racha_id', rachaId);

        if (seq !== requestSeqRef.current) return;

        if (!emailErr && Array.isArray(emailRows)) {
          const map = Object.create(null) as Record<string, string>;
          for (const row of emailRows as { player_id: string; email_lower: string }[]) {
            if (isSafeObjectKey(row.player_id)) {
              map[row.player_id] = row.email_lower;
            }
          }
          setPlayerEmails(map);
        }
      } else {
        setPlayerEmails(Object.create(null) as Record<string, string>);
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [enabled, rachaId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime com debounce para evitar rajadas de refetch
  useEffect(() => {
    if (!enabled || !supabase) return;
    const client = supabase;
    let timer: number | null = null;
    const scheduleReload = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void load();
      }, REALTIME_DEBOUNCE_MS);
    };

    const ch = client
      .channel(`racha_members_${rachaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'racha_members', filter: `racha_id=eq.${rachaId}` },
        scheduleReload
      )
      .subscribe();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      void client.removeChannel(ch);
    };
  }, [enabled, rachaId, load]);

  const linkMemberToPlayer = useCallback(
    async (memberId: string, targetPlayerId: string): Promise<{ error: string | null }> => {
      if (!supabase || !isAdmin) return { error: 'Apenas o administrador pode vincular jogadores.' };
      const { data, error } = await supabase.rpc('admin_link_member_to_player', {
        p_racha_id: rachaId,
        p_member_id: memberId,
        p_target_player_id: targetPlayerId,
      });

      if (error) {
        return { error: translateMemberError(error, 'Não foi possível vincular o jogador.') };
      }
      if (data) {
        const updated = data as RachaMember;
        setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        void load();
      }
      return { error: null };
    },
    [rachaId, isAdmin, load]
  );

  const setPlayerEmail = useCallback(
    async (playerId: string, email: string): Promise<{ error: string | null }> => {
      if (!supabase || !isAdmin) {
        return { error: 'Apenas o administrador pode definir o e-mail do jogador.' };
      }
      if (!isSafeObjectKey(playerId)) return { error: 'Jogador inválido.' };
      const trimmed = email.trim().toLowerCase();
      const { error } = await supabase.rpc('admin_set_player_email', {
        p_racha_id: rachaId,
        p_player_id: playerId,
        p_email: trimmed || null,
      });
      if (error) {
        return { error: translateMemberError(error, 'Não foi possível salvar o e-mail.') };
      }
      setPlayerEmails((prev) => {
        const next = Object.assign(Object.create(null) as Record<string, string>, prev);
        if (trimmed) next[playerId] = trimmed;
        else delete next[playerId];
        return next;
      });
      return { error: null };
    },
    [rachaId, isAdmin]
  );

  const myMember = useMemo(
    () => (userId ? members.find((m) => m.user_id === userId) ?? null : null),
    [members, userId]
  );

  const memberByPlayerId = useMemo(() => {
    const map = new Map<string, RachaMember>();
    for (const m of members) {
      if (m.player_id) map.set(m.player_id, m);
    }
    return map;
  }, [members]);

  return {
    members,
    myMember,
    memberByPlayerId,
    playerEmails,
    loading,
    available,
    authExpired,
    reload: load,
    linkMemberToPlayer,
    setPlayerEmail,
  };
}
