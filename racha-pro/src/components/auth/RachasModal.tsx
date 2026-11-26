import React, { useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { buildShareUrl } from '../../hooks/useRachas';
import { RachaRecord } from '../../types/racha';
import { copyText } from '../../utils/clipboard';
import { normalizeInviteCode } from '../../utils/inviteCode';
import { BrandMark } from '../ui/BrandMark';
import { useToast } from '../ui/Toast';

interface RachasModalProps {
  userEmail: string;
  rachas: RachaRecord[];
  activeRachaId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<{ racha: RachaRecord | null; error: string | null }>;
  onJoinByCode: (
    code: string,
    displayName?: string
  ) => Promise<{
    rachaId: string | null;
    rachaName: string | null;
    linkedExisting: boolean;
    error: string | null;
  }>;
  onRename: (id: string, name: string) => Promise<{ error: string | null }>;
  onTogglePublic: (id: string, isPublic: boolean) => Promise<{ error: string | null }>;
  onRegenerateShareCode: (id: string) => Promise<{ shareCode: string | null; error: string | null }>;
  onRegenerateInviteCode: (
    id: string
  ) => Promise<{ inviteCode: string | null; error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onSignOut: () => void;
  onClose: () => void;
}

export const RachasModal: React.FC<RachasModalProps> = ({
  userEmail,
  rachas,
  activeRachaId,
  onSelect,
  onCreate,
  onJoinByCode,
  onRename,
  onTogglePublic,
  onRegenerateShareCode,
  onRegenerateInviteCode,
  onDelete,
  onSignOut,
  onClose,
}) => {
  const toast = useToast();
  const [actionTab, setActionTab] = useState<'join' | 'create'>('join');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteInput, setInviteInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const ownedRachas = rachas.filter((r) => r.my_role === 'admin');
  const joinedRachas = rachas.filter((r) => r.my_role === 'member');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await onCreate(newName);
    setCreating(false);
    if (res.error) {
      toast.show(res.error, 'error');
      return;
    }
    setNewName('');
    toast.show('Novo racha criado!');
    onClose();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const cleaned = normalizeInviteCode(inviteInput);
    if (!cleaned) {
      setJoinError('Digite o código de convite do racha.');
      return;
    }
    if (displayNameInput.trim().length < 2) {
      setJoinError('Informe seu nome ou apelido na quadra (mínimo 2 letras).');
      return;
    }
    setJoining(true);
    const res = await onJoinByCode(cleaned, displayNameInput);
    setJoining(false);
    if (res.error) {
      setJoinError(res.error);
      return;
    }
    setInviteInput('');
    setDisplayNameInput('');
    toast.show(
      res.linkedExisting
        ? `Você entrou em ${res.rachaName ?? 'racha'} e vinculou seu jogador!`
        : `Você entrou em ${res.rachaName ?? 'racha'}!`
    );
    onClose();
  };

  const handleRenameSubmit = async (id: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setBusyId(id);
    const res = await onRename(id, trimmed);
    setBusyId(null);
    if (res.error) toast.show(res.error, 'error');
    else toast.show('Nome atualizado');
    setEditingId(null);
  };

  const handleTogglePublic = async (racha: RachaRecord) => {
    setBusyId(racha.id);
    const next = !racha.is_public;
    const res = await onTogglePublic(racha.id, next);
    setBusyId(null);
    if (res.error) {
      toast.show(res.error, 'error');
      return;
    }
    toast.show(next ? 'Link de leitura ativado' : 'Link de leitura pausado (privado)', 'info');
  };

  const handleRegenerateShare = async (racha: RachaRecord) => {
    const ok = window.confirm(
      `Gerar um novo link de leitura para "${racha.name}"? O link antigo deixará de funcionar imediatamente.`
    );
    if (!ok) return;
    setBusyId(racha.id);
    const res = await onRegenerateShareCode(racha.id);
    setBusyId(null);
    if (res.error || !res.shareCode) {
      toast.show(res.error || 'Não foi possível gerar novo link', 'error');
      return;
    }
    const copied = await copyText(buildShareUrl(res.shareCode));
    toast.show(
      copied
        ? 'Novo link de leitura gerado e copiado!'
        : 'Novo link gerado! O antigo foi revogado.',
      'success'
    );
  };

  const handleCopyInviteCode = async (racha: RachaRecord) => {
    if (!racha.invite_code) return;
    const ok = await copyText(racha.invite_code);
    toast.show(
      ok
        ? `Código ${racha.invite_code} copiado! Mande para quem tem conta entrar no racha.`
        : 'Não foi possível copiar o código',
      ok ? 'success' : 'error'
    );
  };

  const handleRegenerateInvite = async (racha: RachaRecord) => {
    const ok = window.confirm(
      `Gerar um novo código de convite para "${racha.name}"? O código antigo (${racha.invite_code}) deixará de funcionar imediatamente.`
    );
    if (!ok) return;
    setBusyId(racha.id);
    const res = await onRegenerateInviteCode(racha.id);
    setBusyId(null);
    if (res.error || !res.inviteCode) {
      toast.show(res.error || 'Não foi possível gerar novo código', 'error');
      return;
    }
    const copied = await copyText(res.inviteCode);
    toast.show(
      copied ? `Novo código ${res.inviteCode} gerado e copiado!` : `Novo código: ${res.inviteCode}`,
      'success'
    );
  };

  const handleDelete = async (racha: RachaRecord) => {
    const ok = window.confirm(
      `Apagar o racha "${racha.name}" permanentemente? Elenco, placares e histórico dele serão perdidos.`
    );
    if (!ok) return;
    setBusyId(racha.id);
    const res = await onDelete(racha.id);
    setBusyId(null);
    if (res.error) toast.show(res.error, 'error');
    else toast.show(`"${racha.name}" removido`, 'info');
  };

  const handleCopyShare = async (racha: RachaRecord) => {
    if (!racha.is_public) {
      toast.show('Link está pausado. Ative o acesso público abaixo para compartilhar.', 'info');
      return;
    }
    const url = buildShareUrl(racha.share_code);
    const ok = await copyText(url);
    toast.show(
      ok ? 'Link de leitura copiado! Mande no grupo.' : 'Não foi possível copiar o link',
      ok ? 'success' : 'error'
    );
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rp-card flex max-h-[90vh] w-full max-w-lg animate-sheet-in flex-col rounded-t-[28px] bg-white text-[#0D1510] sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between border-b border-[#0D1510]/[0.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <div>
              <h2 className="text-base font-extrabold tracking-[-0.03em] text-[#0D1510]">
                Meus rachas
              </h2>
              <p className="font-mono text-[11px] font-semibold text-[#647468]">
                {rachas.length} {rachas.length === 1 ? 'racha na conta' : 'rachas na conta'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#0D1510]/10 bg-[#F6F9F2] text-[#647468] hover:text-[#0D1510]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Ações: Entrar por código ou Criar novo racha */}
          <div className="rp-well space-y-3 rounded-[22px] p-3.5">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-white/90 p-1 ring-1 ring-[#0D1510]/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setActionTab('join');
                  setJoinError(null);
                }}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg text-xs font-extrabold transition ${
                  actionTab === 'join'
                    ? 'rp-btn-primary'
                    : 'text-[#647468] hover:text-[#0D1510]'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                Entrar em um racha
              </button>
              <button
                type="button"
                onClick={() => setActionTab('create')}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg text-xs font-extrabold transition ${
                  actionTab === 'create'
                    ? 'rp-btn-primary'
                    : 'text-[#647468] hover:text-[#0D1510]'
                }`}
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                Criar racha
              </button>
            </div>

            {actionTab === 'join' ? (
              <form onSubmit={handleJoin} className="space-y-2.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value.toUpperCase());
                      setJoinError(null);
                    }}
                    maxLength={16}
                    placeholder="Código (ex: RCH4K92X7)"
                    className="rp-input min-w-0 flex-1 rounded-xl px-3 font-mono text-sm font-extrabold uppercase tracking-[0.08em]"
                  />
                  <button
                    type="submit"
                    disabled={joining || !inviteInput.trim() || displayNameInput.trim().length < 2}
                    className="rp-btn-primary flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs disabled:opacity-40"
                  >
                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
                  </button>
                </div>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => {
                    setDisplayNameInput(e.target.value);
                    setJoinError(null);
                  }}
                  required
                  minLength={2}
                  maxLength={40}
                  placeholder="Seu nome na quadra (visível para o grupo)"
                  className="rp-input min-h-[42px] w-full rounded-xl px-3 text-xs font-medium"
                />
                {joinError && (
                  <p className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]">
                    {joinError}
                  </p>
                )}
              </form>
            ) : (
              <form onSubmit={handleCreate} className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={48}
                  placeholder="Nome do racha (ex: Pelada de Sexta)..."
                  className="rp-input min-w-0 flex-1 rounded-xl px-3 text-sm font-medium"
                />
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="rp-btn-primary flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs disabled:opacity-40"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 stroke-[3]" />
                  )}
                  Criar
                </button>
              </form>
            )}
          </div>

          {/* Rachas que administro */}
          {ownedRachas.length > 0 && (
            <div className="space-y-2.5">
              <p className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#647468]">
                <Shield className="h-3.5 w-3.5 text-[#3F6212]" />
                Rachas que organizo ({ownedRachas.length})
              </p>

              {ownedRachas.map((racha) => {
                const isActive = racha.id === activeRachaId;
                const isEditing = editingId === racha.id;
                const isBusy = busyId === racha.id;

                return (
                  <div
                    key={racha.id}
                    className={`rounded-[22px] border p-3.5 transition ${
                      isActive
                        ? 'border-[#84CC16]/55 bg-[#ECFCCB]/45 shadow-sm'
                        : 'border-[#0D1510]/10 bg-[#F6F9F2]/75 hover:border-[#0D1510]/20'
                    }`}
                  >
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleRenameSubmit(racha.id);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          maxLength={48}
                          autoFocus
                          className="rp-input min-h-[44px] min-w-0 flex-1 rounded-xl px-3 text-sm font-bold"
                        />
                        <button
                          type="submit"
                          disabled={isBusy}
                          className="rp-btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          aria-label="Salvar nome"
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rp-btn-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#647468]"
                          aria-label="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(racha.id);
                              onClose();
                            }}
                            className="min-h-[44px] min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-extrabold text-[#0D1510]">
                                {racha.name}
                              </span>
                              {isActive && (
                                <span className="shrink-0 rounded-md bg-[#84CC16]/25 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-[#365314]">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 font-mono text-[11px] font-medium text-[#647468]">
                              {racha.is_public
                                ? `leitura ativa · ${racha.share_code}`
                                : 'link leitura pausado'}
                            </p>
                          </button>

                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => void handleCopyShare(racha)}
                              title="Copiar link somente leitura"
                              aria-label={`Copiar link de ${racha.name}`}
                              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                racha.is_public
                                  ? 'text-[#3F6212] hover:bg-[#ECFCCB]'
                                  : 'text-[#9BA89E] hover:bg-white'
                              }`}
                            >
                              <Link2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(racha.id);
                                setEditDraft(racha.name);
                              }}
                              title="Renomear racha"
                              aria-label={`Renomear ${racha.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#647468] hover:bg-[#FEF3C7] hover:text-[#B45309]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleDelete(racha)}
                              title="Excluir racha"
                              aria-label={`Excluir ${racha.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#647468] hover:bg-[#FEE2E2] hover:text-[#DC2626] disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Código de convite para jogadores autenticados */}
                        {racha.invite_code && (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#84CC16]/35 bg-white px-3 py-2.5 shadow-sm">
                            <div className="min-w-0">
                              <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
                                Código de convite (jogadores)
                              </p>
                              <p className="font-mono text-sm font-extrabold tracking-[0.12em] text-[#365314]">
                                {racha.invite_code}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleCopyInviteCode(racha)}
                                title="Copiar código de convite"
                                className="flex h-9 items-center gap-1 rounded-lg border border-[#65A30D]/40 bg-[#ECFCCB] px-2.5 text-[11px] font-extrabold text-[#365314] hover:bg-[#D9F99D]"
                              >
                                <Copy className="h-3 w-3" />
                                Copiar
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleRegenerateInvite(racha)}
                                title="Gerar novo código e invalidar o atual"
                                aria-label="Regenerar código de convite"
                                className="rp-btn-secondary flex h-9 w-9 items-center justify-center rounded-lg text-[#647468] hover:text-[#0D1510] disabled:opacity-40"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 border-t border-[#0D1510]/[0.07] pt-2.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleTogglePublic(racha)}
                            className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold transition disabled:opacity-40 ${
                              racha.is_public
                                ? 'border-[#65A30D]/30 bg-[#ECFCCB] text-[#365314] hover:bg-[#D9F99D]'
                                : 'border-[#D97706]/30 bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]'
                            }`}
                          >
                            {racha.is_public ? (
                              <>
                                <Globe className="h-3.5 w-3.5" /> Link público ativo
                              </>
                            ) : (
                              <>
                                <Lock className="h-3.5 w-3.5" /> Link pausado
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleRegenerateShare(racha)}
                            title="Invalidar link de leitura atual e gerar um novo"
                            className="rp-btn-secondary inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-3 text-[11px] disabled:opacity-40"
                          >
                            <KeyRound className="h-3 w-3 text-[#3F6212]" /> Trocar link
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Rachas que participo como jogador */}
          {joinedRachas.length > 0 && (
            <div className="space-y-2.5">
              <p className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#647468]">
                <Users className="h-3.5 w-3.5 text-blue-600" />
                Rachas que participo ({joinedRachas.length})
              </p>

              {joinedRachas.map((racha) => {
                const isActive = racha.id === activeRachaId;
                return (
                  <button
                    key={racha.id}
                    type="button"
                    onClick={() => {
                      onSelect(racha.id);
                      onClose();
                    }}
                    className={`flex min-h-[58px] w-full items-center justify-between gap-2 rounded-[20px] border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-[#84CC16]/55 bg-[#ECFCCB]/45 shadow-sm'
                        : 'border-[#0D1510]/10 bg-[#F6F9F2]/75 hover:border-[#0D1510]/20'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-extrabold text-[#0D1510]">
                          {racha.name}
                        </span>
                        {isActive && (
                          <span className="shrink-0 rounded-md bg-[#84CC16]/25 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-[#365314]">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-[#647468]">
                        Confirmar presença e acompanhar estatísticas
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-blue-500/25 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-blue-700">
                      Jogador
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#0D1510]/[0.08] px-5 py-3.5 pb-safe">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#647468]">
              Conta conectada
            </p>
            <p className="truncate text-xs font-bold text-[#0D1510]">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-[#DC2626]/25 bg-[#FEE2E2] px-3.5 text-xs font-bold text-[#991B1B] transition hover:bg-[#FECACA]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};
