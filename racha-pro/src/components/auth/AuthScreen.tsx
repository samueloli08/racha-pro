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
  Trophy,
} from 'lucide-react';
import { AuthActionResult } from '../../hooks/useAuth';

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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-zinc-100">
      <div className="w-full max-w-md space-y-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-xs font-bold text-zinc-300 transition hover:border-lime-300/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao racha
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          <div className="brand-mark mb-4 h-14 w-14 rounded-2xl">
            <Trophy className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-[-0.06em] text-white">
              racha<span className="text-lime-300">pro</span>
            </h1>
            <span className="brand-edition">ARENA</span>
          </div>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-400">
            Organize seus rachas em um só lugar e compartilhe o placar ao vivo em modo leitura com o
            grupo.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#121914]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6">
          {!isConfigured ? (
            <div className="space-y-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
              <p className="font-bold">Supabase não configurado</p>
              <p className="text-red-300/90">
                Defina <code className="font-mono">VITE_SUPABASE_URL</code> e{' '}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> no arquivo{' '}
                <code className="font-mono">.env</code> para usar contas e sincronização.
              </p>
            </div>
          ) : (
            <>
              {mode !== 'reset' ? (
                <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-zinc-950/70 p-1.5">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`min-h-[44px] rounded-xl text-xs font-extrabold transition ${
                      mode === 'login'
                        ? 'bg-gradient-to-br from-lime-200 to-lime-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`min-h-[44px] rounded-xl text-xs font-extrabold transition ${
                      mode === 'signup'
                        ? 'bg-gradient-to-br from-lime-200 to-lime-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Criar conta
                  </button>
                </div>
              ) : (
                <div className="mb-5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-lime-300" />
                    <h2 className="text-sm font-extrabold text-white">Recuperar senha</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="min-h-[44px] px-2 text-xs font-bold text-lime-300 hover:underline"
                  >
                    Voltar ao login
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                      required
                      className="min-h-[46px] w-full rounded-xl border border-white/10 bg-zinc-950/80 pl-10 pr-3.5 text-base text-white placeholder-zinc-500 focus:border-lime-300/70 focus:outline-none"
                    />
                  </div>
                </div>

                {mode !== 'reset' && (
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                        required
                        minLength={mode === 'signup' ? 8 : 6}
                        className="min-h-[46px] w-full rounded-xl border border-white/10 bg-zinc-950/80 pl-10 pr-12 text-base text-white placeholder-zinc-500 focus:border-lime-300/70 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-0 top-0 flex h-[46px] w-11 items-center justify-center text-zinc-500 hover:text-zinc-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Repita sua senha"
                        required
                        minLength={8}
                        className="min-h-[46px] w-full rounded-xl border border-white/10 bg-zinc-950/80 pl-10 pr-3.5 text-base text-white placeholder-zinc-500 focus:border-lime-300/70 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-300">
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="rounded-xl border border-lime-400/30 bg-lime-400/10 px-3.5 py-2.5 text-xs font-medium text-lime-200">
                    {notice}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-lime-200 to-lime-400 text-sm font-extrabold text-zinc-950 shadow-lg shadow-lime-400/15 transition active:scale-[0.98] disabled:opacity-60"
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
                      className="min-h-[44px] px-2 text-xs font-semibold text-zinc-400 hover:text-lime-300"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 text-center">
          {!showCodeBox ? (
            <button
              type="button"
              onClick={() => setShowCodeBox(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 text-xs font-bold text-zinc-300 hover:text-lime-300"
            >
              <Link2 className="h-4 w-4 text-lime-300" />
              Recebeu um link ou código do grupo? Abrir só leitura
            </button>
          ) : (
            <form onSubmit={handleOpenCode} className="space-y-2.5 text-left">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Link ou código do racha
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  placeholder="Ex: a7k2m9p4 ou cole o link"
                  autoFocus
                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white placeholder-zinc-500 focus:border-lime-300/70 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!shareInput.trim()}
                  className="min-h-[44px] shrink-0 rounded-xl bg-zinc-800 px-4 text-xs font-extrabold text-lime-300 hover:bg-zinc-700 disabled:opacity-40"
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
