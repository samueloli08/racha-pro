import React from 'react';
import { ChevronDown, CloudOff, Eye, Link2, Loader2, LogIn } from 'lucide-react';
import { RachaRole, SyncStatus } from '../../types/racha';
import { BrandMark } from '../ui/BrandMark';

interface HeaderProps {
  rachaName: string;
  presentCount: number;
  matchesCount: number;
  syncStatus: SyncStatus;
  isMatchRunning?: boolean;
  role: RachaRole;
  isLoggedIn: boolean;
  onRetrySync: () => void;
  onOpenRachas?: () => void;
  onCopyShareLink?: () => void;
  onOpenAuth?: () => void;
  onBackToMyRachas?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  rachaName,
  presentCount,
  matchesCount,
  syncStatus,
  isMatchRunning = false,
  role,
  isLoggedIn,
  onRetrySync,
  onOpenRachas,
  onCopyShareLink,
  onOpenAuth,
  onBackToMyRachas,
}) => {
  const isViewer = role === 'viewer';
  const isAdmin = role === 'admin';
  const isMember = role === 'member';
  const isLivePill = syncStatus === 'synced' && (isMatchRunning || isViewer);

  const syncMeta = (() => {
    if (syncStatus === 'saving') {
      return {
        label: !isAdmin ? 'Atualizando' : 'Salvando',
        tone: 'sync-saving',
        hint: 'Enviando alterações para a nuvem',
      };
    }
    if (syncStatus === 'offline') {
      return {
        label: 'Offline',
        tone: 'sync-offline',
        hint: 'Sem conexão. Toque para tentar sincronizar',
      };
    }
    return {
      label: isLivePill ? 'Ao vivo' : 'Sincronizado',
      tone: 'sync-online',
      hint: !isAdmin ? 'Recebendo atualizações em tempo real' : 'Tudo salvo na nuvem',
    };
  })();

  return (
    <header className="app-header">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark size="md" />
          <div className="min-w-0">
            {isViewer ? (
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[16px] font-extrabold leading-tight tracking-[-0.04em] text-[#F4F7F2]">
                  {rachaName}
                </h1>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#FBBF24]/35 bg-[#FBBF24]/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#FDE68A]">
                  <Eye className="h-3 w-3" />
                  Leitura
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenRachas}
                title="Trocar de racha, entrar com código ou gerenciar conta"
                className="group flex max-w-full items-center gap-1.5 rounded-lg text-left transition hover:text-[#D9F99D]"
              >
                <h1 className="truncate text-[16px] font-extrabold leading-tight tracking-[-0.04em] text-[#F4F7F2] group-hover:text-[#D9F99D]">
                  {rachaName}
                </h1>
                {isMember && (
                  <span className="shrink-0 rounded-md border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#93C5FD]">
                    Jogador
                  </span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 text-[#BEF264] transition group-hover:translate-y-0.5" />
              </button>
            )}
            <p className="truncate text-[11px] font-medium text-[#879287]">
              {presentCount} presentes <span className="mx-1 text-[#4B554C]">/</span> {matchesCount}{' '}
              {matchesCount === 1 ? 'partida hoje' : 'partidas hoje'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isAdmin && onCopyShareLink && (
            <button
              type="button"
              onClick={onCopyShareLink}
              title="Copiar link somente leitura para o grupo"
              aria-label="Copiar link somente leitura"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.11] bg-[#111713] text-[#BEF264] transition hover:border-[#BEF264]/40 hover:bg-[#84CC16]/10"
            >
              <Link2 className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onRetrySync}
            title={syncMeta.hint}
            aria-label={`${syncMeta.label}. ${syncMeta.hint}`}
            className={`sync-pill min-h-[44px] ${syncMeta.tone}`}
          >
            {syncStatus === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : syncStatus === 'offline' ? (
              <CloudOff className="h-3.5 w-3.5" />
            ) : (
              <span className="sync-dot" />
            )}
            <span className={isLivePill ? 'inline' : 'hidden sm:inline'}>{syncMeta.label}</span>
          </button>

          {isViewer &&
            (isLoggedIn ? (
              <button
                type="button"
                onClick={onBackToMyRachas}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#BEF264]/30 bg-[#84CC16]/10 px-3 text-xs font-extrabold text-[#D9F99D] transition hover:bg-[#84CC16]/20"
              >
                Meus rachas
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#111713] px-3 text-xs font-bold text-[#F4F7F2] transition hover:border-[#BEF264]/40 hover:text-[#D9F99D]"
              >
                <LogIn className="h-3.5 w-3.5 text-[#BEF264]" />
                Entrar
              </button>
            ))}
        </div>
      </div>
      <div className="header-rule" />
    </header>
  );
};
