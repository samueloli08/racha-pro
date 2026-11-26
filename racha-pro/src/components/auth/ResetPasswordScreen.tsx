import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, LogOut } from 'lucide-react';
import { AuthActionResult } from '../../hooks/useAuth';
import { BrandMark } from '../ui/BrandMark';

interface ResetPasswordScreenProps {
  userEmail: string;
  onUpdatePassword: (newPassword: string) => Promise<AuthActionResult>;
  onSignOut: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  userEmail,
  onUpdatePassword,
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-[#0D1510]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <BrandMark size="md" />
            <div className="min-w-0">
              <p className="rp-eyebrow">SEGURANÇA</p>
              <p className="max-w-[200px] truncate text-xs font-medium text-[#647468]">
                {userEmail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rp-btn-secondary inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl px-3.5 text-xs hover:border-[#DC2626]/35 hover:text-[#DC2626]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>

        <div className="rp-card rp-stagger rounded-[28px] p-6">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#3F6212]" />
            <h2 className="text-xl font-extrabold tracking-[-0.04em] text-[#0D1510]">
              Definir nova senha
            </h2>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-[#647468]">
            Por segurança, defina uma nova senha (mínimo 8 caracteres) para concluir a recuperação
            da sua conta.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                Nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647468]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  maxLength={128}
                  autoFocus
                  className="rp-input w-full rounded-2xl pl-10 pr-12 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-0 top-0 flex h-[46px] w-11 items-center justify-center text-[#647468] hover:text-[#0D1510]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                Confirmar nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647468]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  required
                  minLength={8}
                  maxLength={128}
                  className="rp-input w-full rounded-2xl pl-10 pr-3.5 text-sm font-medium"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3.5 py-2.5 text-xs font-semibold text-[#991B1B]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rp-btn-primary flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] text-sm disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova senha
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
