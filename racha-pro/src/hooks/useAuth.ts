import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthActionResult {
  error: string | null;
  needsEmailConfirmation?: boolean;
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada ou spam.';
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

function clearLocalRachaCaches(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('rachapro_racha_') ||
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
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
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
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      const lower = error.message.toLowerCase();
      // Evita enumeração de contas: não revela explicitamente se o e-mail já existe
      if (lower.includes('already registered') || lower.includes('already been registered')) {
        return { error: null, needsEmailConfirmation: true };
      }
      return { error: translateAuthError(error.message) };
    }

    // Quando confirmação de e-mail está ativa e o e-mail já existe, Supabase retorna identities vazio
    const alreadyExistsObfuscated =
      Boolean(data.user) &&
      Array.isArray(data.user?.identities) &&
      data.user.identities.length === 0;
    const needsEmailConfirmation = !data.session || alreadyExistsObfuscated;

    return { error: null, needsEmailConfirmation };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Serviço de autenticação não configurado.' };
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Serviço de autenticação não configurado.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: translateAuthError(error.message) };
    setIsPasswordRecovery(false);
    // Limpa eventuais tokens no hash da URL após concluir a recuperação
    if (window.location.hash) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    }
    return { error: null };
  }, []);

  const cancelPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    clearLocalRachaCaches();
    setIsPasswordRecovery(false);
    if (!supabase) return;
    await supabase.auth.signOut();
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
    cancelPasswordRecovery,
    signOut,
  };
}
