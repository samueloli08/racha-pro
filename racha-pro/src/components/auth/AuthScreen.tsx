import React, { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import { AuthActionResult } from '../../hooks/useAuth';
import { BrandLockup } from '../ui/BrandMark';

type AuthMode = 'login' | 'signup' | 'reset';

interface AuthScreenProps {
  isConfigured: boolean;
  onSignIn: (email: string, password: string) => Promise<AuthActionResult>;
  onSignUp: (email: string, password: string) => Promise<AuthActionResult>;
  onResetPassword: (email: string) => Promise<AuthActionResult>;
  onOpenShareCode: (code: string) => void;
  onCancel?: () => void;
}

function extractShareCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const param = parsed.searchParams.get('racha');
    if (param) return param.trim().toLowerCase();
  } catch {
    // não é URL completa; trata como código direto
  }
  const match = trimmed.match(/racha=([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1].toLowerCase();
  return trimmed.toLowerCase();
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isConfigured,
  onSignIn,
  onSignUp,
  onResetPassword,
  onOpenShareCode,
  onCancel,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCodeBox, setShowCodeBox] = useState(false);
  const [shareInput, setShareInput] = useState('');

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }

    if (mode === 'reset') {
      setSubmitting(true);
      const res = await onResetPassword(email);
      setSubmitting(false);
      if (res.error) setError(res.error);
      else setNotice('Enviamos um link de redefinição para o seu e-mail.');
      return;
    }

    const minLen = mode === 'signup' ? 8 : 6;
    if (password.length < minLen) {
      setError(`A senha precisa ter pelo menos ${minLen} caracteres.`);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    const res =
      mode === 'login' ? await onSignIn(email, password) : await onSignUp(email, password);
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (mode === 'signup' && res.needsEmailConfirmation) {
      setNotice(
        'Se este e-mail ainda não estiver cadastrado, enviamos as instruções para confirmar sua conta. Caso já tenha conta, tente entrar.'
      );
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleOpenCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractShareCode(shareInput);
    if (!code) return;
    onOpenShareCode(code);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-[#F4F7F2]">
      <div className="w-full max-w-md space-y-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rp-btn-secondary inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-3.5 text-xs"
          >
            <ArrowLeft className="h-4 w-4 text-[#BEF264]" />
            Voltar ao racha
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          <BrandLockup size="lg" showTagline />
        </div>

        <div className="rp-card rounded-[28px] p-5 sm:p-6">
          {!isConfigured ? (
            <div className="space-y-2 rounded-2xl border border-[#F87171]/35 bg-[#F87171]/10 p-4 text-xs text-[#FCA5A5]">
              <p className="font-bold text-[#F4F7F2]">Supabase não configurado</p>
              <p>
                Defina <code className="font-mono">VITE_SUPABASE_URL</code> e{' '}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> no arquivo{' '}
                <code className="font-mono">.env</code> para usar contas e sincronização.
              </p>
            </div>
          ) : (
            <>
              {mode !== 'reset' ? (
                <div className="rp-well mb-5 grid grid-cols-2 gap-1.5 rounded-[18px] p-1.5">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`min-h-[44px] rounded-[13px] text-xs font-extrabold transition ${
                      mode === 'login' ? 'rp-btn-primary' : 'text-[#879287] hover:text-[#F4F7F2]'
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`min-h-[44px] rounded-[13px] text-xs font-extrabold transition ${
                      mode === 'signup' ? 'rp-btn-primary' : 'text-[#879287] hover:text-[#F4F7F2]'
                    }`}
                  >
                    Criar conta
                  </button>
                </div>
              ) : (
                <div className="mb-5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#BEF264]" />
                    <h2 className="text-sm font-extrabold text-[#F7FAEF]">Recuperar senha</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="min-h-[44px] px-2 text-xs font-bold text-[#BEF264] hover:underline"
                  >
                    Voltar ao login
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#879287]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                      required
                      className="rp-input w-full rounded-2xl pl-10 pr-3.5 text-base"
                    />
                  </div>
                </div>

                {mode !== 'reset' && (
                  <div>
                    <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#879287]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                        required
                        minLength={mode === 'signup' ? 8 : 6}
                        className="rp-input w-full rounded-2xl pl-10 pr-12 text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-0 top-0 flex h-[46px] w-11 items-center justify-center text-[#879287] hover:text-[#F4F7F2]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#879287]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Repita sua senha"
                        required
                        minLength={8}
                        className="rp-input w-full rounded-2xl pl-10 pr-3.5 text-base"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-[#F87171]/35 bg-[#F87171]/10 px-3.5 py-2.5 text-xs font-medium text-[#FCA5A5]">
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="rounded-2xl border border-[#BEF264]/30 bg-[#84CC16]/10 px-3.5 py-2.5 text-xs font-medium text-[#D9F99D]">
                    {notice}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="rp-btn-primary flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] text-sm disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === 'login'
                    ? 'Entrar na conta'
                    : mode === 'signup'
                    ? 'Criar minha conta'
                    : 'Enviar link de recuperação'}
                </button>

                {mode === 'login' && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="min-h-[44px] px-2 text-xs font-semibold text-[#879287] hover:text-[#BEF264]"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <div className="rp-surface rounded-[22px] p-4 text-center">
          {!showCodeBox ? (
            <button
              type="button"
              onClick={() => setShowCodeBox(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 text-xs font-bold text-[#C9D3C4] hover:text-[#D9F99D]"
            >
              <Link2 className="h-4 w-4 text-[#BEF264]" />
              Recebeu um link ou código do grupo? Abrir só leitura
            </button>
          ) : (
            <form onSubmit={handleOpenCode} className="space-y-2.5 text-left">
              <label className="block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                Link ou código do racha
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  placeholder="Ex: a7k2m9p4x1q8 ou cole o link"
                  autoFocus
                  className="rp-input min-w-0 flex-1 rounded-xl px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={!shareInput.trim()}
                  className="flex min-h-[46px] shrink-0 items-center rounded-xl border border-[#BEF264]/35 bg-[#84CC16]/12 px-4 text-xs font-extrabold text-[#D9F99D] disabled:opacity-40"
                >
                  Abrir
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
