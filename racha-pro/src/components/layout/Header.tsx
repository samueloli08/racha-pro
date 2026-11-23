import React from 'react';
import {
  ChevronDown,
  Cloud,
  CloudOff,
  Eye,
  Link2,
  Loader2,
  LogIn,
  Trophy,
} from 'lucide-react';
import { SyncStatus } from '../../types/racha';

interface HeaderProps {
  rachaName: string;
  presentCount: number;
  matchesCount: number;
  syncStatus: SyncStatus;
  readOnly: boolean;
  isLoggedIn: boolean;
  onRetrySync: () => void;
  onOpenRachas?: () => void;
  onCopyShareLink?: () => void;
  onOpenAuth?: () => void;
  onBackToMyRachas?: () => void;
}

const SYNC_UI: Record<
  SyncStatus,
  { label: string; readLabel: string; icon: React.ReactNode; tone: string; hint: string }
> = {
  synced: {
    label: 'Sincronizado',
    readLabel: 'Ao vivo',
    icon: <Cloud className="h-3.5 w-3.5" />,
    tone: 'sync-online',
    hint: 'Tudo salvo na nuvem',
  },
  saving: {
    label: 'Salvando...',
    readLabel: 'Atualizando...',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    tone: 'sync-saving',
    hint: 'Enviando alterações para a nuvem',
  },
  offline: {
    label: 'Offline',
    readLabel: 'Offline',
    icon: <CloudOff className="h-3.5 w-3.5" />,
    tone: 'sync-offline',
    hint: 'Sem conexão. Toque para tentar sincronizar',
  },
};

export const Header: React.FC<HeaderProps> = ({
  rachaName,
  presentCount,
  matchesCount,
  syncStatus,
  readOnly,
  isLoggedIn,
  onRetrySync,
  onOpenRachas,
  onCopyShareLink,
  onOpenAuth,
  onBackToMyRachas,
}) => {
  const ui = SYNC_UI[syncStatus];
  const syncLabel = readOnly ? ui.readLabel : ui.label;

  return (
    <header className="app-header">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="brand-mark shrink-0">
            <Trophy className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            {readOnly ? (
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[16px] font-extrabold tracking-[-0.04em] text-white">
                  {rachaName}
                </h1>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-amber-300">
                  <Eye className="h-3 w-3" />
                  Leitura
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenRachas}
                title="Trocar de racha ou gerenciar conta"
                className="group flex max-w-full items-center gap-1 rounded-lg text-left transition hover:text-lime-300"
              >
                <h1 className="truncate text-[16px] font-extrabold tracking-[-0.04em] text-white group-hover:text-lime-200">
                  {rachaName}
                </h1>
                <ChevronDown className="h-4 w-4 shrink-0 text-lime-300 transition group-hover:translate-y-0.5" />
              </button>
            )}
            <p className="truncate text-[11px] font-medium text-zinc-400">
              {presentCount} presentes <span className="mx-1 text-zinc-700">/</span> {matchesCount}{' '}
              partidas hoje
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!readOnly && onCopyShareLink && (
            <button
              type="button"
              onClick={onCopyShareLink}
              title="Copiar link somente leitura para o grupo"
              aria-label="Copiar link somente leitura"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-900/70 text-lime-300 transition hover:border-lime-300/40 hover:bg-lime-400/10 active:scale-95"
            >
              <Link2 className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onRetrySync}
            title={ui.hint}
            aria-label={`${syncLabel}. ${ui.hint}`}
            className={`sync-pill ${ui.tone}`}
          >
            {ui.icon}
            <span className="hidden sm:inline">{syncLabel}</span>
            <span className="sync-dot" />
          </button>

          {readOnly &&
            (isLoggedIn ? (
              <button
                type="button"
                onClick={onBackToMyRachas}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-lime-300/30 bg-lime-400/10 px-3 text-xs font-extrabold text-lime-200 transition hover:bg-lime-400/20"
              >
                Meus rachas
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-zinc-900/80 px-3 text-xs font-bold text-white transition hover:border-lime-300/40 hover:text-lime-200"
              >
                <LogIn className="h-3.5 w-3.5 text-lime-300" />
                Entrar
              </button>
            ))}
        </div>
      </div>
      <div className="header-rule" />
    </header>
  );
};
