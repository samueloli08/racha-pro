import React, { useMemo, useState } from 'react';
import { Check, Loader2, LogOut, Plus, Sparkles, Trophy } from 'lucide-react';
import { readLegacyLocalState } from '../../hooks/useRachas';
import { RachaStoreState } from '../../types/racha';

interface FirstRachaScreenProps {
  userEmail: string;
  onCreate: (
    name: string,
    initialData?: Partial<RachaStoreState> | null
  ) => Promise<{ error: string | null }>;
  onSignOut: () => void;
}

const SUGGESTIONS = ['Racha de Quarta', 'Pelada de Sábado', 'Futebol da Firma', 'Society de Domingo'];

export const FirstRachaScreen: React.FC<FirstRachaScreenProps> = ({
  userEmail,
  onCreate,
  onSignOut,
}) => {
  const legacyData = useMemo(() => readLegacyLocalState(), []);
  const [name, setName] = useState('');
  const [importLegacy, setImportLegacy] = useState(Boolean(legacyData));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Escolha um nome para o seu racha.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await onCreate(name, importLegacy ? legacyData : null);
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
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-lime-300">
                Bem-vindo
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
          <p className="page-eyebrow">PRIMEIRO PASSO</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Crie seu primeiro racha</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Você pode ter quantos rachas quiser na sua conta — cada um com seu elenco, histórico e
            link de leitura próprio.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Nome do racha
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={48}
                autoFocus
                placeholder="Ex: Racha de Quarta"
                className="min-h-[46px] w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3.5 text-base text-white placeholder-zinc-500 focus:border-lime-300/70 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setName(s)}
                    className="rounded-lg border border-white/10 bg-zinc-950/70 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-lime-300/40 hover:text-lime-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {legacyData && (
              <button
                type="button"
                onClick={() => setImportLegacy((v) => !v)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                  importLegacy
                    ? 'border-lime-300/50 bg-lime-400/10'
                    : 'border-white/10 bg-zinc-950/60'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    importLegacy
                      ? 'border-lime-300 bg-lime-300 text-zinc-950'
                      : 'border-zinc-700 bg-zinc-900'
                  }`}
                >
                  {importLegacy && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Sparkles className="h-3.5 w-3.5 text-lime-300" />
                    Importar dados salvos neste aparelho
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Encontramos {legacyData.players?.length ?? 0} jogador(es) salvos localmente
                    antes do login.
                  </p>
                </div>
              </button>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-lime-200 to-lime-400 text-sm font-extrabold text-zinc-950 shadow-lg shadow-lime-400/15 transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 stroke-[3]" />}
              Criar racha
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
