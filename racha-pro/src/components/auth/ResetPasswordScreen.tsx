import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, LogOut, Trophy } from 'lucide-react';
import { AuthActionResult } from '../../hooks/useAuth';

interface ResetPasswordScreenProps {
  userEmail: string;
  onUpdatePassword: (newPassword: string) => Promise<AuthActionResult>;
  onCancel: () => void;
  onSignOut: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  userEmail,
  onUpdatePassword,
  onCancel,
  onSignOut,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    const res = await onUpdatePassword(password);
    setSubmitting(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-zinc-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="brand-mark">
              <Trophy className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-lime-300">
                Recuperação de senha
              </p>
              <p className="max-w-[200px] truncate text-xs text-zinc-400">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-xs font-bold text-zinc-300 hover:border-red-400/40 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#121914]/95 p-6 shadow-2xl shadow-black/40">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-lime-300" />
            <h2 className="text-xl font-black tracking-tight text-white">Definir nova senha</h2>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-zinc-400">
            Escolha uma nova senha com pelo menos 8 caracteres para voltar a acessar sua conta com
            segurança.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  autoFocus
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

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Confirmar nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  required
                  minLength={8}
                  className="min-h-[46px] w-full rounded-xl border border-white/10 bg-zinc-950/80 pl-10 pr-3.5 text-base text-white placeholder-zinc-500 focus:border-lime-300/70 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-lime-200 to-lime-400 text-sm font-extrabold text-zinc-950 shadow-lg shadow-lime-400/15 transition active:scale-[0.98] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova senha
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] w-full text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Continuar sem alterar agora
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
