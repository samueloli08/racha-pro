import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
  Shuffle,
  Timer,
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

const HIGHLIGHTS = [
  {
    icon: <Shuffle className="h-4 w-4 text-[#3F6212]" />,
    title: 'Sorteio equilibrado em segundos',
    text: 'Balanceie coletes por nível e distribua goleiros automaticamente.',
  },
  {
    icon: <Timer className="h-4 w-4 text-[#3F6212]" />,
    title: 'Placar ao vivo e fila inteligente',
    text: 'Cronômetro com apito, gols, assistências e rotação automática na quadra.',
  },
  {
    icon: <BarChart3 className="h-4 w-4 text-[#3F6212]" />,
    title: 'Presença e estatísticas individuais',
    text: 'Cada jogador confirma presença por código e acompanha seus próprios números.',
  },
];

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
      else {
        setNotice(
          'Se este e-mail estiver cadastrado, enviaremos um link de redefinição para sua caixa de entrada.'
        );
      }
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-[#0D1510] sm:px-8">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Coluna Editorial da Marca (Esquerda no Desktop) */}
        <div className="space-y-6 lg:col-span-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rp-btn-secondary inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl px-3.5 text-xs"
            >
              <ArrowLeft className="h-4 w-4 text-[#3F6212]" />
              Voltar ao racha
            </button>
          )}

          <div className="flex justify-center lg:hidden">
            <BrandLockup size="lg" showTagline align="center" />
          </div>

          <div className="hidden space-y-6 lg:block">
            <BrandLockup size="lg" align="left" />
            <div>
              <h1 className="text-4xl font-extrabold leading-[1.06] tracking-[-0.055em] text-[#0D1510]">
                O comando completo da sua pelada, ao vivo.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#5B6B5F]">
                Organize listas, sorteie times equilibrados, controle o placar em quadra e compartilhe
                números com o grupo em tempo real.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {HIGHLIGHTS.map((item, idx) => (
                <div
                  key={item.title}
                  style={{ '--stagger': idx } as React.CSSProperties}
                  className="rp-surface rp-stagger flex items-start gap-3.5 rounded-2xl p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECFCCB]">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold tracking-[-0.02em] text-[#0D1510]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#647468]">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna de Formulário (Direita no Desktop) */}
        <div className="mx-auto w-full max-w-md space-y-4 lg:col-span-6 lg:max-w-none">
          <div className="rp-card rp-stagger rounded-[30px] p-6 sm:p-7">
            {!isConfigured ? (
              <div className="space-y-2 rounded-2xl border border-[#DC2626]/30 bg-[#FEE2E2] p-4 text-xs text-[#991B1B]">
                <p className="font-extrabold text-[#7F1D1D]">Serviço indisponível</p>
                <p>
                  {import.meta.env.DEV ? (
                    <>
                      Defina <code className="font-mono font-bold">VITE_SUPABASE_URL</code> e{' '}
                      <code className="font-mono font-bold">VITE_SUPABASE_ANON_KEY</code> no arquivo{' '}
                      <code className="font-mono font-bold">.env</code> para usar contas e
                      sincronização.
                    </>
                  ) : (
                    'O serviço de autenticação não está disponível no momento. Tente novamente mais tarde.'
                  )}
                </p>
              </div>
            ) : (
              <>
                {mode !== 'reset' ? (
                  <div className="rp-well mb-6 grid grid-cols-2 gap-1.5 rounded-[18px] p-1.5">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className={`min-h-[44px] rounded-[13px] text-xs font-extrabold transition ${
                        mode === 'login'
                          ? 'rp-btn-primary'
                          : 'text-[#647468] hover:text-[#0D1510]'
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className={`min-h-[44px] rounded-[13px] text-xs font-extrabold transition ${
                        mode === 'signup'
                          ? 'rp-btn-primary'
                          : 'text-[#647468] hover:text-[#0D1510]'
                      }`}
                    >
                      Criar conta
                    </button>
                  </div>
                ) : (
                  <div className="mb-5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[#3F6212]" />
                      <h2 className="text-base font-extrabold text-[#0D1510]">Recuperar senha</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="min-h-[40px] px-2 text-xs font-extrabold text-[#3F6212] hover:underline"
                    >
                      Voltar ao login
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647468]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="voce@exemplo.com"
                        maxLength={254}
                        required
                        className="rp-input w-full rounded-2xl pl-10 pr-3.5 text-sm font-medium"
                      />
                    </div>
                  </div>

                  {mode !== 'reset' && (
                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                        Senha
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647468]" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                          required
                          minLength={mode === 'signup' ? 8 : 6}
                          maxLength={128}
                          className="rp-input w-full rounded-2xl pl-10 pr-12 text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute right-0 top-0 flex h-[46px] w-11 items-center justify-center text-[#647468] hover:text-[#0D1510]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'signup' && (
                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                        Confirmar senha
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647468]" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="Repita sua senha"
                          required
                          minLength={8}
                          maxLength={128}
                          className="rp-input w-full rounded-2xl pl-10 pr-3.5 text-sm font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3.5 py-2.5 text-xs font-semibold text-[#991B1B]">
                      {error}
                    </div>
                  )}

                  {notice && (
                    <div className="rounded-2xl border border-[#65A30D]/35 bg-[#ECFCCB] px-3.5 py-2.5 text-xs font-semibold text-[#365314]">
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
                        className="min-h-[40px] px-2 text-xs font-bold text-[#647468] hover:text-[#3F6212]"
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
                className="inline-flex min-h-[42px] items-center justify-center gap-2 text-xs font-bold text-[#46544A] hover:text-[#3F6212]"
              >
                <Link2 className="h-4 w-4 text-[#3F6212]" />
                Recebeu um link ou código do grupo? Abrir só leitura
              </button>
            ) : (
              <form onSubmit={handleOpenCode} className="space-y-2.5 text-left">
                <label className="block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                  Link ou código do racha
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareInput}
                    onChange={(e) => setShareInput(e.target.value)}
                    placeholder="Ex: a7k2m9p4x1q8 ou cole o link"
                    maxLength={256}
                    autoFocus
                    className="rp-input min-w-0 flex-1 rounded-xl px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!shareInput.trim()}
                    className="rp-btn-dark flex min-h-[46px] shrink-0 items-center rounded-xl px-4 text-xs disabled:opacity-40"
                  >
                    Abrir
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
