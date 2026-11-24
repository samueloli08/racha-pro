import React, { useMemo, useState } from 'react';
import { Check, Loader2, LogIn, LogOut, Plus, Sparkles } from 'lucide-react';
import { readLegacyLocalState } from '../../hooks/useRachas';
import { RachaStoreState } from '../../types/racha';
import { normalizeInviteCode } from '../../utils/inviteCode';
import { BrandMark } from '../ui/BrandMark';

interface FirstRachaScreenProps {
  userEmail: string;
  onCreate: (
    name: string,
    initialData?: Partial<RachaStoreState> | null
  ) => Promise<{ error: string | null }>;
  onJoinByCode: (
    code: string,
    displayName?: string
  ) => Promise<{ error: string | null; rachaName?: string | null }>;
  onSignOut: () => void;
}

const SUGGESTIONS = ['Racha de Quarta', 'Pelada de Sábado', 'Futebol da Firma', 'Society de Domingo'];

export const FirstRachaScreen: React.FC<FirstRachaScreenProps> = ({
  userEmail,
  onCreate,
  onJoinByCode,
  onSignOut,
}) => {
  const legacyData = useMemo(() => readLegacyLocalState(), []);
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const [name, setName] = useState('');
  // Opt-in explícito: nunca importa dados locais antigos automaticamente em dispositivo compartilhado
  const [importLegacy, setImportLegacy] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
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

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeInviteCode(inviteCode);
    if (!cleaned) {
      setError('Digite o código de convite recebido do organizador.');
      return;
    }
    if (displayName.trim().length < 2) {
      setError('Informe seu nome ou apelido na quadra (mínimo 2 letras).');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await onJoinByCode(cleaned, displayName);
    setSubmitting(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-[#F4F7F2]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <BrandMark size="md" />
            <div>
              <p className="rp-eyebrow">BEM-VINDO</p>
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
          <div className="rp-well mb-5 grid grid-cols-2 gap-1.5 rounded-[18px] p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setError(null);
              }}
              className={`min-h-[44px] rounded-[13px] text-xs font-extrabold transition ${
                mode === 'create' ? 'rp-btn-primary' : 'text-[#879287] hover:text-[#F4F7F2]'
              }`}
            >
              Criar racha
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setError(null);
              }}
              className={`min-h-[44px] rounded-[13px] text-xs font-extrabold transition ${
                mode === 'join' ? 'rp-btn-primary' : 'text-[#879287] hover:text-[#F4F7F2]'
              }`}
            >
              Entrar em um racha
            </button>
          </div>

          {mode === 'create' ? (
            <>
              <p className="page-eyebrow">ORGANIZADOR</p>
              <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.055em] text-[#F7FAEF]">
                Crie seu primeiro racha
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#879287]">
                Cada racha tem elenco, código de convite para jogadores e placar ao vivo próprio.
              </p>

              <form onSubmit={handleCreate} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                    Nome do racha
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={48}
                    autoFocus
                    placeholder="Ex: Racha de Quarta"
                    className="rp-input w-full rounded-2xl px-3.5 text-base"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setName(s)}
                        className="rp-well rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-[#C9D3C4] transition hover:border-[#BEF264]/40 hover:text-[#D9F99D]"
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
                        ? 'border-[#BEF264]/45 bg-[#84CC16]/10'
                        : 'border-white/[0.085] bg-[#0B100D]'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        importLegacy
                          ? 'border-[#BEF264] bg-[#BEF264] text-[#10160A]'
                          : 'border-white/20 bg-[#111713]'
                      }`}
                    >
                      {importLegacy && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-[#F4F7F2]">
                        <Sparkles className="h-3.5 w-3.5 text-[#BEF264]" />
                        Importar dados salvos neste aparelho
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#879287]">
                        Encontramos {legacyData.players?.length ?? 0} jogador(es) salvos localmente
                        antes do login.
                      </p>
                    </div>
                  </button>
                )}

                {error && (
                  <div className="rounded-2xl border border-[#F87171]/35 bg-[#F87171]/10 px-3.5 py-2.5 text-xs font-medium text-[#FCA5A5]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="rp-btn-primary flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] text-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 stroke-[3]" />
                  )}
                  Criar racha
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="page-eyebrow">JOGADOR</p>
              <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.055em] text-[#F7FAEF]">
                Entrar em um racha
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#879287]">
                Digite o código curto enviado pelo organizador para confirmar presença e acompanhar
                suas estatísticas.
              </p>

              <form onSubmit={handleJoin} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                    Código de convite
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    maxLength={16}
                    autoFocus
                    placeholder="Ex: RCH4K92X7"
                    className="rp-input w-full rounded-2xl px-3.5 font-mono text-base font-extrabold uppercase tracking-[0.1em]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
                    Seu nome na quadra
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={40}
                    placeholder="Como o pessoal te chama"
                    className="rp-input w-full rounded-2xl px-3.5 text-base"
                  />
                  <p className="mt-1 text-[11px] text-[#879287]">
                    Visível para o grupo. Seu e-mail nunca é compartilhado.
                  </p>
                </div>

                {error && (
                  <div className="rounded-2xl border border-[#F87171]/35 bg-[#F87171]/10 px-3.5 py-2.5 text-xs font-medium text-[#FCA5A5]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !inviteCode.trim() || displayName.trim().length < 2}
                  className="rp-btn-primary flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] text-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  Entrar no racha
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
