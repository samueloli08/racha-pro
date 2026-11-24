import React, { useState } from 'react';
import {
  Check,
  Globe,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { buildShareUrl } from '../../hooks/useRachas';
import { RachaRecord } from '../../types/racha';
import { copyText } from '../../utils/clipboard';
import { BrandMark } from '../ui/BrandMark';
import { useToast } from '../ui/Toast';

interface RachasModalProps {
  userEmail: string;
  rachas: RachaRecord[];
  activeRachaId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<{ racha: RachaRecord | null; error: string | null }>;
  onRename: (id: string, name: string) => Promise<{ error: string | null }>;
  onTogglePublic: (id: string, isPublic: boolean) => Promise<{ error: string | null }>;
  onRegenerateShareCode: (id: string) => Promise<{ shareCode: string | null; error: string | null }>;
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
  onRename,
  onTogglePublic,
  onRegenerateShareCode,
  onDelete,
  onSignOut,
  onClose,
}) => {
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const handleRegenerate = async (racha: RachaRecord) => {
    const ok = window.confirm(
      `Gerar um novo link para "${racha.name}"? O link antigo deixará de funcionar imediatamente.`
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
      copied ? 'Novo link gerado e copiado!' : 'Novo link gerado! O antigo foi revogado.',
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
        className="rp-card flex max-h-[88vh] w-full max-w-md animate-sheet-in flex-col rounded-t-[28px] text-[#F4F7F2] sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.085] px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <div>
              <h2 className="text-base font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
                Meus rachas
              </h2>
              <p className="font-mono text-[11px] text-[#879287]">
                {rachas.length} {rachas.length === 1 ? 'racha na conta' : 'rachas na conta'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.085] bg-[#0B100D] text-[#879287] hover:text-[#F4F7F2]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={48}
              placeholder="Novo racha (ex: Pelada de Sexta)..."
              className="rp-input min-w-0 flex-1 rounded-2xl px-3.5 text-sm"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rp-btn-primary flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-2xl px-4 text-xs disabled:opacity-40"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 stroke-[3]" />
              )}
              Criar
            </button>
          </form>

          <div className="space-y-2.5">
            {rachas.map((racha) => {
              const isActive = racha.id === activeRachaId;
              const isEditing = editingId === racha.id;
              const isBusy = busyId === racha.id;

              return (
                <div
                  key={racha.id}
                  className={`rounded-[20px] border p-3 transition ${
                    isActive
                      ? 'border-[#BEF264]/45 bg-[#84CC16]/10'
                      : 'border-white/[0.085] bg-[#0B100D] hover:border-white/[0.16]'
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
                        className="rp-btn-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#879287]"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-2.5">
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
                            <span className="truncate text-sm font-extrabold text-[#F4F7F2]">
                              {racha.name}
                            </span>
                            {isActive && (
                              <span className="shrink-0 rounded-md bg-[#BEF264]/20 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-[#BEF264]">
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-[#879287]">
                            {racha.is_public
                              ? `link ativo · ${racha.share_code}`
                              : 'link pausado (privado)'}
                          </p>
                        </button>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => void handleCopyShare(racha)}
                            title="Copiar link somente leitura"
                            aria-label={`Copiar link de ${racha.name}`}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              racha.is_public
                                ? 'text-[#BEF264] hover:bg-[#84CC16]/15'
                                : 'text-[#4B554C] hover:bg-white/[0.04]'
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
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#879287] hover:bg-white/[0.04] hover:text-[#FDE68A]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDelete(racha)}
                            title="Excluir racha"
                            aria-label={`Excluir ${racha.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#879287] hover:bg-white/[0.04] hover:text-[#F87171] disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 border-t border-white/[0.06] pt-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleTogglePublic(racha)}
                          className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold transition disabled:opacity-40 ${
                            racha.is_public
                              ? 'border-[#BEF264]/25 bg-[#84CC16]/10 text-[#D9F99D] hover:bg-[#84CC16]/18'
                              : 'border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FDE68A] hover:bg-[#FBBF24]/18'
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
                          onClick={() => void handleRegenerate(racha)}
                          title="Invalidar link atual e gerar um novo"
                          className="rp-btn-secondary inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-2.5 text-[11px] disabled:opacity-40"
                        >
                          <RefreshCw className="h-3 w-3" /> Trocar link
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.085] px-5 py-3.5 pb-safe">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#879287]">
              Conta conectada
            </p>
            <p className="truncate text-xs font-semibold text-[#C9D3C4]">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3.5 text-xs font-bold text-[#FCA5A5] transition hover:bg-[#F87171]/18"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};
