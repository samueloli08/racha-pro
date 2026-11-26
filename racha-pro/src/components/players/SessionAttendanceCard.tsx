import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Lock,
  Unlock,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  Player,
  RachaMember,
  RachaRole,
  RachaSession,
  RsvpStatus,
  SessionRsvp,
  SessionStatus,
} from '../../types/racha';
import { canModifyRsvp } from '../../utils/permissions';
import { useToast } from '../ui/Toast';

interface SessionAttendanceCardProps {
  role: RachaRole;
  activeSession: RachaSession | null;
  rsvps: SessionRsvp[];
  myRsvp: SessionRsvp | null;
  members: RachaMember[];
  players: Player[];
  submitting: boolean;
  onCreateSession: (title: string, scheduledAt?: string | null) => Promise<{ error: string | null }>;
  onSetSessionStatus: (
    sessionId: string,
    status: SessionStatus
  ) => Promise<{ error: string | null }>;
  onSetMyRsvp: (status: RsvpStatus) => Promise<{ error: string | null }>;
  onApplyConfirmedToPresence?: (confirmedPlayerIds: string[]) => void;
}

function formatScheduledDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SessionAttendanceCard: React.FC<SessionAttendanceCardProps> = ({
  role,
  activeSession,
  rsvps,
  myRsvp,
  members,
  players,
  submitting,
  onCreateSession,
  onSetSessionStatus,
  onSetMyRsvp,
  onApplyConfirmedToPresence,
}) => {
  const toast = useToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [titleDraft, setTitleDraft] = useState('Próxima Pelada');
  const [dateDraft, setDateDraft] = useState('');

  const isAdmin = role === 'admin';
  const canRespond = canModifyRsvp(role, activeSession);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const grouped = useMemo(() => {
    const going: { id: string; label: string; playerId: string | null }[] = [];
    const maybe: { id: string; label: string; playerId: string | null }[] = [];
    const notGoing: { id: string; label: string; playerId: string | null }[] = [];

    for (const rsvp of rsvps) {
      const player = rsvp.player_id ? playerMap.get(rsvp.player_id) : null;
      const member = memberMap.get(rsvp.member_id);
      const item = {
        id: rsvp.id,
        label: player?.name ?? member?.display_name ?? 'Jogador',
        playerId: rsvp.player_id ?? member?.player_id ?? null,
      };
      if (rsvp.status === 'going') going.push(item);
      else if (rsvp.status === 'maybe') maybe.push(item);
      else notGoing.push(item);
    }

    return { going, maybe, notGoing };
  }, [rsvps, playerMap, memberMap]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    let iso: string | null = null;
    if (dateDraft) {
      const parsed = new Date(dateDraft);
      if (Number.isNaN(parsed.getTime())) {
        toast.show('Data ou horário inválido.', 'error');
        return;
      }
      iso = parsed.toISOString();
    }
    const res = await onCreateSession(titleDraft, iso);
    if (res.error) {
      toast.show(res.error, 'error');
      return;
    }
    setShowNewForm(false);
    setTitleDraft('Próxima Pelada');
    setDateDraft('');
    toast.show('Confirmações abertas para a próxima sessão!');
  };

  const handleRespond = async (status: RsvpStatus) => {
    if (!canRespond || submitting) return;
    const res = await onSetMyRsvp(status);
    if (res.error) {
      toast.show(res.error, 'error');
      return;
    }
    const labels: Record<RsvpStatus, string> = {
      going: 'Presença confirmada!',
      maybe: 'Resposta marcada como Talvez',
      not_going: 'Ausência registrada',
    };
    toast.show(labels[status], status === 'going' ? 'success' : 'info');
  };

  const handleToggleLock = async () => {
    if (!activeSession || !isAdmin) return;
    const next: SessionStatus = activeSession.status === 'open' ? 'closed' : 'open';
    const res = await onSetSessionStatus(activeSession.id, next);
    if (res.error) {
      toast.show(res.error, 'error');
      return;
    }
    toast.show(
      next === 'closed'
        ? 'Confirmações encerradas. Alterações bloqueadas.'
        : 'Confirmações reabertas!',
      'info'
    );
  };

  const handleSyncToElenco = () => {
    if (!onApplyConfirmedToPresence) return;
    const ids = grouped.going
      .map((item) => item.playerId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      toast.show('Nenhum confirmado vinculado ao elenco ainda.', 'info');
      return;
    }
    onApplyConfirmedToPresence(ids);
    toast.show(`${ids.length} confirmado(s) marcado(s) como presentes no Elenco!`);
  };

  const renderCreateForm = () => (
    <form onSubmit={handleCreate} className="rp-well space-y-2.5 rounded-2xl p-3">
      <div className="grid grid-cols-1 gap-2">
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          maxLength={80}
          placeholder="Ex: Pelada de Quarta"
          className="rp-input min-h-[42px] rounded-xl px-3 text-sm font-semibold"
        />
        <input
          type="datetime-local"
          value={dateDraft}
          onChange={(e) => setDateDraft(e.target.value)}
          aria-label="Data e horário da sessão"
          className="rp-input min-h-[42px] rounded-xl px-3 font-mono text-xs"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rp-btn-primary flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl text-xs disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Abrir confirmações
        </button>
        <button
          type="button"
          onClick={() => setShowNewForm(false)}
          className="rp-btn-secondary min-h-[42px] rounded-xl px-3.5 text-xs"
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  if (!activeSession) {
    return (
      <div className="rp-card rp-stagger space-y-3 rounded-[26px] p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="rp-eyebrow">PRÓXIMA SESSÃO</p>
            <h3 className="text-base font-extrabold tracking-[-0.03em] text-[#0D1510]">
              Confirmação de presença
            </h3>
          </div>
          {isAdmin && !showNewForm && (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="rp-btn-primary flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Abrir lista
            </button>
          )}
        </div>

        {showNewForm ? (
          renderCreateForm()
        ) : (
          <p className="text-xs leading-relaxed text-[#647468]">
            {isAdmin
              ? 'Abra uma sessão para os membros confirmarem presença pelo celular antes da pelada.'
              : 'Aguardando o organizador abrir a lista de presença da próxima sessão.'}
          </p>
        )}
      </div>
    );
  }

  const isOpen = activeSession.status === 'open';
  const formattedDate = formatScheduledDate(activeSession.scheduled_at);

  return (
    <div className="rp-card rp-stagger space-y-4 rounded-[26px] p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`font-mono text-[10px] font-extrabold uppercase tracking-[0.14em] ${
                isOpen ? 'text-[#3F6212]' : 'text-[#B45309]'
              }`}
            >
              {isOpen ? 'CONFIRMAÇÕES ABERTAS' : 'CONFIRMAÇÕES ENCERRADAS'}
            </span>
            {formattedDate && (
              <span className="font-mono text-[10px] font-bold text-[#647468]">
                · {formattedDate}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 truncate text-base font-extrabold tracking-[-0.03em] text-[#0D1510]">
            {activeSession.title}
          </h3>
        </div>

        <span className="shrink-0 rounded-xl border border-[#84CC16]/40 bg-[#ECFCCB] px-2.5 py-1 font-mono text-xs font-extrabold text-[#365314] tabular-nums">
          {grouped.going.length} {grouped.going.length === 1 ? 'confirmado' : 'confirmados'}
        </span>
      </div>

      {/* Botões de resposta do jogador */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              {
                id: 'going' as RsvpStatus,
                label: 'Vou jogar',
                icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
                activeCls: 'rp-btn-primary border-transparent',
              },
              {
                id: 'maybe' as RsvpStatus,
                label: 'Talvez',
                icon: <HelpCircle className="h-4 w-4 shrink-0" />,
                activeCls: 'border-[#D97706]/50 bg-[#FEF3C7] text-[#92400E] shadow-sm',
              },
              {
                id: 'not_going' as RsvpStatus,
                label: 'Não vou',
                icon: <XCircle className="h-4 w-4 shrink-0" />,
                activeCls: 'border-[#DC2626]/40 bg-[#FEE2E2] text-[#991B1B] shadow-sm',
              },
            ] as const
          ).map((opt) => {
            const selected = myRsvp?.status === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!canRespond || submitting}
                onClick={() => void handleRespond(opt.id)}
                className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl border px-2 text-xs font-extrabold transition disabled:opacity-50 ${
                  selected
                    ? opt.activeCls
                    : 'border-[#0D1510]/10 bg-[#F6F9F2] text-[#3A473E] hover:border-[#84CC16]/50 hover:bg-[#ECF3E4]'
                }`}
              >
                {opt.icon}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {!isOpen && (
          <p className="flex items-center gap-1.5 rounded-xl bg-[#FEF3C7] px-3 py-2 font-mono text-[11px] font-bold text-[#92400E]">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Lista fechada pelo organizador — não é possível alterar respostas.
          </p>
        )}
      </div>

      {/* Listas separadas visualmente: Confirmados / Talvez / Não vão */}
      <div className="space-y-3 border-t border-[#0D1510]/[0.08] pt-3.5">
        <div>
          <p className="mb-1.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#3F6212]">
            Confirmados ({grouped.going.length})
          </p>
          {grouped.going.length === 0 ? (
            <p className="text-xs text-[#647468]">Ninguém confirmou ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {grouped.going.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex min-h-[32px] items-center rounded-xl border border-[#84CC16]/40 bg-[#ECFCCB] px-2.5 text-xs font-bold text-[#365314]"
                >
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {grouped.maybe.length > 0 && (
          <div>
            <p className="mb-1.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#B45309]">
              Indecisos ({grouped.maybe.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {grouped.maybe.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex min-h-[32px] items-center rounded-xl border border-[#D97706]/30 bg-[#FEF3C7] px-2.5 text-xs font-bold text-[#92400E]"
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {grouped.notGoing.length > 0 && (
          <div>
            <p className="mb-1.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#DC2626]">
              Ausentes ({grouped.notGoing.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {grouped.notGoing.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex min-h-[32px] items-center rounded-xl border border-[#0D1510]/10 bg-[#F6F9F2] px-2.5 text-xs font-semibold text-[#647468] line-through"
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controles administrativos da sessão */}
      {isAdmin && (
        <div className="space-y-2 border-t border-[#0D1510]/[0.08] pt-3.5">
          {showNewForm ? (
            renderCreateForm()
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleToggleLock()}
                className="rp-btn-secondary flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs disabled:opacity-50"
              >
                {isOpen ? (
                  <>
                    <Lock className="h-3.5 w-3.5 text-[#D97706]" /> Encerrar lista
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5 text-[#3F6212]" /> Reabrir lista
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="rp-btn-secondary flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
              >
                <CalendarPlus className="h-3.5 w-3.5 text-[#3F6212]" /> Nova sessão
              </button>

              {grouped.going.length > 0 && onApplyConfirmedToPresence && (
                <button
                  type="button"
                  onClick={handleSyncToElenco}
                  className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#65A30D]/40 bg-[#ECFCCB] px-3 text-xs font-extrabold text-[#365314] transition hover:bg-[#D9F99D]"
                >
                  <UserCheck className="h-4 w-4" />
                  Aplicar {grouped.going.length} confirmado(s) no check-in do Elenco
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
