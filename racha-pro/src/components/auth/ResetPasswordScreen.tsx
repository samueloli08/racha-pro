import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, LogOut } from 'lucide-react';
import { AuthActionResult } from '../../hooks/useAuth';
import { BrandMark } from '../ui/BrandMark';

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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-[#F4F7F2]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <BrandMark size="md" />
            <div className="min-w-0">
              <p className="rp-eyebrow">SEGURANÇA</p>
              <p className="max-w-[200px] truncate text-xs text-[#879287]">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rp-btn-secondary inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-3.5 text-xs hover:border-[#F87171]/40 hover:text-[#FCA5A5]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>

        <div className="rp-card rounded-[28px] p-6">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#BEF264]" />
            <h2 className="text-xl font-extrabold tracking-[-0.04em] text-[#F7FAEF]">
              Definir nova senha
            </h2>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-[#879287]">
            Escolha uma nova senha com pelo menos 8 caracteres para voltar a acessar sua conta com
            segurança.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                Nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#879287]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  autoFocus
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

            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                Confirmar nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#879287]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  required
                  minLength={8}
                  className="rp-input w-full rounded-2xl pl-10 pr-3.5 text-base"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[#F87171]/35 bg-[#F87171]/10 px-3.5 py-2.5 text-xs font-medium text-[#FCA5A5]">
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

            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] w-full text-xs font-semibold text-[#879287] hover:text-[#F4F7F2]"
            >
              Continuar sem alterar agora
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
