import React from 'react';
import { Cloud, CloudOff, Loader2, Trophy } from 'lucide-react';
import { SyncStatus } from '../../types/racha';

interface HeaderProps {
  presentCount: number;
  matchesCount: number;
  syncStatus: SyncStatus;
  onRetrySync: () => void;
}

const SYNC_UI: Record<
  SyncStatus,
  { label: string; dot: string; pill: string; icon: React.ReactNode; hint: string }
> = {
  synced: {
    label: 'Sincronizado',
    dot: 'bg-emerald-400',
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    icon: <Cloud className="h-3.5 w-3.5" />,
    hint: 'Tudo salvo na nuvem',
  },
  saving: {
    label: 'Salvando...',
    dot: 'bg-amber-400',
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    hint: 'Enviando alterações para a nuvem',
  },
  offline: {
    label: 'Offline (Local)',
    dot: 'bg-red-400',
    pill: 'border-red-500/30 bg-red-500/10 text-red-400',
    icon: <CloudOff className="h-3.5 w-3.5" />,
    hint: 'Salvando só neste aparelho. Toque para tentar sincronizar',
  },
};

export const Header: React.FC<HeaderProps> = ({
  presentCount,
  matchesCount,
  syncStatus,
  onRetrySync,
}) => {
  const ui = SYNC_UI[syncStatus];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20">
            <Trophy className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight text-white">
              Racha<span className="text-emerald-400">Pro</span>
            </h1>
            <p className="truncate text-[11px] font-medium text-zinc-400">
              {presentCount} presentes • {matchesCount} jogos hoje
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRetrySync}
          title={ui.hint}
          aria-label={`${ui.label}. ${ui.hint}`}
          className="flex min-h-[44px] shrink-0 items-center"
        >
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${ui.pill}`}
          >
            {ui.icon}
            {ui.label}
          </span>
        </button>
      </div>
    </header>
  );
};
