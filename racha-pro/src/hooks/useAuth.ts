import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthActionResult {
  error: string | null;
  needsEmailConfirmation?: boolean;
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('email not confirmed')) {
    return 'E-mail ou senha incorretos, ou conta ainda aguardando confirmação por e-mail.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'Escolha uma senha mais forte (mínimo de 8 caracteres).';
  }
  if (lower.includes('same password') || lower.includes('different from the old')) {
    return 'A nova senha precisa ser diferente da senha atual.';
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'Informe um endereço de e-mail válido.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Sem conexão com o servidor. Verifique sua internet.';
  }
  if (import.meta.env.DEV) {
    console.warn('[auth] erro:', message);
  }
  return 'Não foi possível concluir a autenticação. Tente novamente.';
}

/** Limpa todos os caches locais do RachaPro (evita vazamento entre contas em dispositivo compartilhado). */
export function clearLocalRachaCaches(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key === 'rachapro_state_v1' ||
          key.startsWith('rachapro_racha_') ||
          key.startsWith('rachapro_dirty_') ||
          key.startsWith('rachapro_last_racha_'))
      ) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignora
  }
}

function scrubAuthUrlTokens(): void {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.hash && (url.hash.includes('access_token') || url.hash.includes('type=recovery'))) {
      url.hash = '';
      changed = true;
    }
    if (url.searchParams.has('code') || url.searchParams.has('token_hash')) {
      url.searchParams.delete('code');
      url.searchParams.delete('token_hash');
      url.searchParams.delete('type');
      changed = true;
    }
    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  } catch {
    // ignora
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        scrubAuthUrlTokens();
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        clearLocalRachaCaches();
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Serviço de autenticação não configurado.' };
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Serviço de autenticação não configurado.' };
    const emailRedirectTo = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes('already registered') || lower.includes('already been registered')) {
        return { error: null, needsEmailConfirmation: true };
      }
      return { error: translateAuthError(error.message) };
    }

    const alreadyExistsObfuscated =
      Boolean(data.user) &&
      Array.isArray(data.user?.identities) &&
      data.user.identities.length === 0;
    const needsEmailConfirmation = !data.session || alreadyExistsObfuscated;

    return { error: null, needsEmailConfirmation };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Serviço de autenticação não configurado.' };
    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Serviço de autenticação não configurado.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: translateAuthError(error.message) };
    setIsPasswordRecovery(false);
    scrubAuthUrlTokens();
    return { error: null };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setIsPasswordRecovery(false);
    scrubAuthUrlTokens();
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      setUser(null);
      clearLocalRachaCaches();
      // Garante limpeza também após desmontagem dos efeitos do workspace
      window.setTimeout(clearLocalRachaCaches, 50);
    }
  }, []);

  return {
    user,
    loading,
    isConfigured: Boolean(supabase),
    isPasswordRecovery,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
  };
}
