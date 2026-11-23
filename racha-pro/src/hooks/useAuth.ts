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
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Este e-mail já está cadastrado. Tente entrar na sua conta.';
  }
  if (lower.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
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
  return message || 'Não foi possível concluir a autenticação.';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Supabase não configurado.' };
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Supabase não configurado.' };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) return { error: translateAuthError(error.message) };

    // Quando o Supabase está com confirmação de e-mail ativada, session vem nula.
    const needsEmailConfirmation = !data.session;
    return { error: null, needsEmailConfirmation };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: 'Supabase não configurado.' };
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return {
    user,
    loading,
    isConfigured: Boolean(supabase),
    signIn,
    signUp,
    resetPassword,
    signOut,
  };
}
