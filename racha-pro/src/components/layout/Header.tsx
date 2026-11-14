import React from 'react';
import { Cloud, CloudOff, Loader2, Trophy } from 'lucide-react';
import { SyncStatus } from '../../types/racha';

interface HeaderProps {
  presentCount: number;
  matchesCount: number;
  syncStatus: SyncStatus;
  onRetrySync: () => void;
}

const SYNC_UI: Record<SyncStatus, { label: string; icon: React.ReactNode; tone: string; hint: string }> = {
  synced: { label: 'Sincronizado', icon: <Cloud className="h-3.5 w-3.5" />, tone: 'sync-online', hint: 'Tudo salvo na nuvem' },
  saving: { label: 'Salvando...', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, tone: 'sync-saving', hint: 'Enviando alterações para a nuvem' },
  offline: { label: 'Offline (Local)', icon: <CloudOff className="h-3.5 w-3.5" />, tone: 'sync-offline', hint: 'Salvando só neste aparelho. Toque para tentar sincronizar' },
};

export const Header: React.FC<HeaderProps> = ({ presentCount, matchesCount, syncStatus, onRetrySync }) => {
  const ui = SYNC_UI[syncStatus];
  return (
    <header className="app-header">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark"><Trophy className="h-5 w-5" strokeWidth={2.5} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-extrabold tracking-[-0.06em] text-white">racha<span className="text-lime-300">pro</span></h1>
              <span className="brand-edition">ARENA</span>
            </div>
            <p className="truncate text-[11px] font-medium text-zinc-400">{presentCount} presentes <span className="mx-1 text-zinc-700">/</span> {matchesCount} partidas hoje</p>
          </div>
        </div>
        <button type="button" onClick={onRetrySync} title={ui.hint} aria-label={`${ui.label}. ${ui.hint}`} className={`sync-pill ${ui.tone}`}>
          {ui.icon}<span>{ui.label}</span><span className="sync-dot" />
        </button>
      </div>
      <div className="header-rule" />
    </header>
  );
};
