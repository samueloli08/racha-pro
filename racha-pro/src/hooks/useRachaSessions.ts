import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RachaRole, RachaSession, RsvpStatus, SessionRsvp, SessionStatus } from '../types/racha';
import { canModifyRsvp } from '../utils/permissions';

const REALTIME_DEBOUNCE_MS = 350;

function isSessionExpiredError(err: { code?: string; status?: number; message?: string }): boolean {
  const msg = (err.message ?? '').toLowerCase();
  return err.code === 'PGRST301' || err.status === 401 || msg.includes('jwt');
}

function translateSessionError(err: unknown, fallback: string): string {
  const obj = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: string;
    message?: string;
  };
  const msg = (obj.message ?? '').toUpperCase();

  if (msg.includes('SESSION_CLOSED')) {
    return 'As confirmações desta sessão já foram encerradas pelo organizador.';
  }
  if (msg.includes('FORBIDDEN')) return 'Você não tem permissão para esta ação.';
  if (msg.includes('UNAUTHORIZED')) return 'Faça login para confirmar presença.';
  if (msg.includes('SESSION_NOT_FOUND')) return 'Sessão não encontrada.';
  return fallback;
}

export function useRachaSessions(
  rachaId: string,
  userId: string | null,
  role: RachaRole
) {
  const [sessions, setSessions] = useState<RachaSession[]>([]);
  const [rsvps, setRsvps] = useState<SessionRsvp[]>([]);
  const [myConfirmedCount, setMyConfirmedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState(true);
  const [authExpired, setAuthExpired] = useState(false);

  const requestSeqRef = useRef(0);
  const enabled = Boolean(supabase && rachaId && userId && role !== 'viewer');
  const isAdmin = role === 'admin';

  const activeSession = useMemo(() => {
    const open = sessions.find((s) => s.status === 'open');
    if (open) return open;
    return sessions.find((s) => s.status === 'closed') ?? null;
  }, [sessions]);

  const load = useCallback(async () => {
    if (!enabled || !supabase || !userId) {
      setSessions([]);
      setRsvps([]);
      setMyConfirmedCount(0);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const { data: sessionRows, error: sessionErr } = await supabase
        .from('racha_sessions')
        .select('id, racha_id, title, scheduled_at, status, created_by, closed_at, created_at, updated_at')
        .eq('racha_id', rachaId)
        .order('created_at', { ascending: false })
        .limit(12);

      if (seq !== requestSeqRef.current) return;

      if (sessionErr) {
        if (sessionErr.code === '42P01' || sessionErr.code === 'PGRST205') {
          setAvailable(false);
        } else if (isSessionExpiredError(sessionErr)) {
          setAuthExpired(true);
        }
        return;
      }

      setAuthExpired(false);
      setAvailable(true);
      const list = (sessionRows ?? []) as RachaSession[];
      setSessions(list);

      const current =
        list.find((s) => s.status === 'open') ?? list.find((s) => s.status === 'closed') ?? null;

      if (current) {
        const { data: rsvpRows, error: rsvpErr } = await supabase
          .from('session_rsvps')
          .select('id, session_id, racha_id, member_id, user_id, player_id, status, created_at, updated_at')
          .eq('session_id', current.id)
          .order('updated_at', { ascending: true });

        if (seq !== requestSeqRef.current) return;
        if (rsvpErr) {
          if (isSessionExpiredError(rsvpErr)) setAuthExpired(true);
        } else {
          setRsvps((rsvpRows ?? []) as SessionRsvp[]);
        }
      } else {
        setRsvps([]);
      }

      const { count, error: countErr } = await supabase
        .from('session_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('racha_id', rachaId)
        .eq('user_id', userId)
        .eq('status', 'going');

      if (seq !== requestSeqRef.current) return;
      if (!countErr) {
        setMyConfirmedCount(count ?? 0);
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [enabled, rachaId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime com debounce/coalescência contra rajadas de RSVPs
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
      .channel(`racha_sessions_${rachaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'racha_sessions', filter: `racha_id=eq.${rachaId}` },
        scheduleReload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_rsvps', filter: `racha_id=eq.${rachaId}` },
        scheduleReload
      )
      .subscribe();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      void client.removeChannel(ch);
    };
  }, [enabled, rachaId, load]);

  const createSession = useCallback(
    async (title: string, scheduledAt?: string | null): Promise<{ error: string | null }> => {
      if (!supabase || !isAdmin) {
        return { error: 'Apenas o administrador pode abrir uma nova sessão.' };
      }
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc('create_racha_session', {
          p_racha_id: rachaId,
          p_title: title.trim() || 'Próxima Pelada',
          p_scheduled_at: scheduledAt || null,
        });
        if (error) {
          return { error: translateSessionError(error, 'Não foi possível abrir a sessão.') };
        }
        await load();
        return { error: null };
      } finally {
        setSubmitting(false);
      }
    },
    [rachaId, isAdmin, load]
  );

  const setSessionStatus = useCallback(
    async (sessionId: string, status: SessionStatus): Promise<{ error: string | null }> => {
      if (!supabase || !isAdmin) {
        return { error: 'Apenas o administrador pode alterar o status da sessão.' };
      }
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc('set_racha_session_status', {
          p_session_id: sessionId,
          p_status: status,
        });
        if (error) {
          return { error: translateSessionError(error, 'Não foi possível atualizar a sessão.') };
        }
        await load();
        return { error: null };
      } finally {
        setSubmitting(false);
      }
    },
    [isAdmin, load]
  );

  const setMyRsvp = useCallback(
    async (status: RsvpStatus): Promise<{ error: string | null }> => {
      if (!supabase || !activeSession || !userId || !canModifyRsvp(role, activeSession)) {
        return {
          error:
            activeSession && activeSession.status !== 'open'
              ? 'As confirmações desta sessão já foram encerradas.'
              : 'Não é possível confirmar presença agora.',
        };
      }
      setSubmitting(true);
      try {
        const prevStatus = rsvps.find((r) => r.user_id === userId)?.status;
        const { data, error } = await supabase.rpc('upsert_session_rsvp', {
          p_session_id: activeSession.id,
          p_status: status,
        });
        if (error) {
          return { error: translateSessionError(error, 'Não foi possível registrar sua resposta.') };
        }
        if (data) {
          const saved = data as SessionRsvp;
          setRsvps((prev) => {
            const exists = prev.some((r) => r.member_id === saved.member_id);
            return exists
              ? prev.map((r) => (r.member_id === saved.member_id ? saved : r))
              : [...prev, saved];
          });
          if (prevStatus !== 'going' && saved.status === 'going') {
            setMyConfirmedCount((c) => c + 1);
          } else if (prevStatus === 'going' && saved.status !== 'going') {
            setMyConfirmedCount((c) => Math.max(0, c - 1));
          }
        }
        return { error: null };
      } finally {
        setSubmitting(false);
      }
    },
    [activeSession, userId, role, rsvps]
  );

  const myRsvp = useMemo(
    () => (userId ? rsvps.find((r) => r.user_id === userId) ?? null : null),
    [rsvps, userId]
  );

  return {
    sessions,
    activeSession,
    rsvps,
    myRsvp,
    myConfirmedCount,
    loading,
    submitting,
    available,
    authExpired,
    reload: load,
    createSession,
    setSessionStatus,
    setMyRsvp,
  };
}
