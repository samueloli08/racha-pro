import React, { useState } from 'react';
import { Link2, Loader2, Shield, UserCheck, Users, X } from 'lucide-react';
import { Player, RachaMember } from '../../types/racha';
import { useToast } from '../ui/Toast';

interface MemberLinkModalProps {
  members: RachaMember[];
  players: Player[];
  currentUserId: string | null;
  onLinkMember: (memberId: string, targetPlayerId: string) => Promise<{ error: string | null }>;
  onClose: () => void;
}

export const MemberLinkModal: React.FC<MemberLinkModalProps> = ({
  members,
  players,
  currentUserId,
  onLinkMember,
  onClose,
}) => {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedByMember, setSelectedByMember] = useState<Record<string, string>>({});

  const linkedPlayerOwner = new Map<string, RachaMember>();
  for (const m of members) {
    if (m.player_id) linkedPlayerOwner.set(m.player_id, m);
  }
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const handleLink = async (member: RachaMember) => {
    const targetId = selectedByMember[member.id];
    if (!targetId || targetId === member.player_id) return;

    setBusyId(member.id);
    const res = await onLinkMember(member.id, targetId);
    setBusyId(null);

    if (res.error) {
      toast.show(res.error, 'error');
      return;
    }
    const targetPlayer = playerMap.get(targetId);
    toast.show(
      `${member.display_name} vinculado a ${targetPlayer?.name ?? 'jogador'} (histórico preservado)`
    );
    setSelectedByMember((prev) => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#84CC16]/15 text-[#BEF264]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
                Membros e vínculos
              </h2>
              <p className="font-mono text-[11px] text-[#879287]">
                {members.length} {members.length === 1 ? 'conta vinculada' : 'contas no racha'}
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

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-safe">
          <p className="text-xs leading-relaxed text-[#879287]">
            Associe qualquer membro autenticado a um jogador existente do elenco para preservar todo
            o histórico de gols, assistências e partidas dele. Nunca vinculamos contas apenas por
            nome parecido.
          </p>

          {members.length === 0 ? (
            <p className="rp-well rounded-2xl p-6 text-center text-xs text-[#879287]">
              Nenhum membro entrou ainda. Compartilhe o código de convite em Meus Rachas.
            </p>
          ) : (
            members.map((member) => {
              const linkedPlayer = member.player_id ? playerMap.get(member.player_id) : null;
              const isMe = member.user_id === currentUserId;
              const draft = selectedByMember[member.id] ?? member.player_id ?? '';
              const isBusy = busyId === member.id;

              const availablePlayers = players.filter((p) => {
                const owner = linkedPlayerOwner.get(p.id);
                return !owner || owner.id === member.id;
              });

              return (
                <div
                  key={member.id}
                  className="rp-well space-y-2.5 rounded-[20px] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-extrabold text-[#F4F7F2]">
                          {member.display_name}
                        </span>
                        {isMe && (
                          <span className="rounded-md bg-[#84CC16]/15 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-[#BEF264]">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#879287]">
                        {linkedPlayer ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5 text-[#BEF264]" />
                            <span>
                              Jogador: <strong className="text-[#C9D3C4]">{linkedPlayer.name}</strong>
                            </span>
                          </>
                        ) : (
                          <span>Sem jogador vinculado ainda</span>
                        )}
                      </p>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${
                        member.role === 'admin'
                          ? 'border border-[#BEF264]/30 bg-[#84CC16]/12 text-[#BEF264]'
                          : 'border border-white/10 bg-white/[0.04] text-[#C9D3C4]'
                      }`}
                    >
                      {member.role === 'admin' && <Shield className="h-3 w-3" />}
                      {member.role === 'admin' ? 'Admin' : 'Jogador'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={draft}
                      onChange={(e) =>
                        setSelectedByMember((prev) => ({
                          ...prev,
                          [member.id]: e.target.value,
                        }))
                      }
                      aria-label={`Selecionar jogador para ${member.display_name}`}
                      className="rp-input min-h-[42px] min-w-0 flex-1 rounded-xl px-2.5 text-xs font-bold"
                    >
                      <option value="">Escolher jogador do elenco...</option>
                      {availablePlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isGoalkeeper ? ' (GOL)' : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isBusy || !draft || draft === member.player_id}
                      onClick={() => void handleLink(member)}
                      className="rp-btn-primary flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs disabled:opacity-40"
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      Vincular
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
