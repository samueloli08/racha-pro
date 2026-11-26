import React from 'react';
import {
  BarChart3,
  ChevronDown,
  CircleDot,
  CloudOff,
  Eye,
  Link2,
  Loader2,
  LogIn,
  Shield,
  Shuffle,
  UserCheck,
  Users,
} from 'lucide-react';
import { RachaRole, SyncStatus, TabId } from '../../types/racha';
import { BrandLockup } from '../ui/BrandMark';

interface DesktopSidebarProps {
  rachaName: string;
  presentCount: number;
  matchesCount: number;
  teamsCount: number;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
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

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  rachaName,
  presentCount,
  matchesCount,
  teamsCount,
  activeTab,
  onSelectTab,
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

  const navItems: {
    id: TabId;
    label: string;
    badge?: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'players',
      label: 'Elenco',
      badge: presentCount > 0 ? String(presentCount) : undefined,
      icon: <Users />,
    },
    {
      id: 'sort',
      label: 'Times',
      badge: teamsCount > 0 ? String(teamsCount) : undefined,
      icon: <Shuffle />,
    },
    {
      id: 'match',
      label: 'Ao vivo',
      badge: isMatchRunning ? 'LIVE' : undefined,
      icon: <CircleDot />,
    },
    {
      id: 'stats',
      label: 'Números',
      badge: matchesCount > 0 ? String(matchesCount) : undefined,
      icon: <BarChart3 />,
    },
  ];

  const syncMeta = (() => {
    if (syncStatus === 'saving') {
      return {
        label: !isAdmin ? 'Atualizando' : 'Salvando...',
        tone: 'sync-saving',
        hint: 'Enviando alterações para a nuvem',
      };
    }
    if (syncStatus === 'offline') {
      return {
        label: 'Offline',
        tone: 'sync-offline',
        hint: 'Sem conexão. Clique para tentar sincronizar',
      };
    }
    return {
      label: isLivePill ? 'Ao vivo' : 'Sincronizado',
      tone: 'sync-online',
      hint: !isAdmin ? 'Recebendo atualizações em tempo real' : 'Tudo salvo na nuvem',
    };
  })();

  return (
    <aside
      className="desktop-sidebar fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col justify-between overflow-y-auto p-5 lg:flex"
      aria-label="Menu lateral"
    >
      <div className="space-y-6">
        <div className="px-1 pt-1">
          <BrandLockup size="sm" align="left" />
        </div>

        {/* Seletor de Racha Ativo */}
        {isViewer ? (
          <div className="rounded-2xl border border-[#0D1510]/10 bg-[#F6F9F2] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-[#D97706]/30 bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#92400E]">
                <Eye className="h-3 w-3" />
                Leitura
              </span>
              <span className="font-mono text-[10px] font-bold text-[#647468]">
                {matchesCount} {matchesCount === 1 ? 'jogo' : 'jogos'}
              </span>
            </div>
            <p className="mt-2 truncate text-[15px] font-extrabold tracking-[-0.03em] text-[#0D1510]">
              {rachaName}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[#647468]">
              {presentCount} presentes na quadra
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={!onOpenRachas}
            onClick={onOpenRachas}
            title="Trocar de racha, entrar com código ou gerenciar conta"
            className="group w-full rounded-2xl border border-[#0D1510]/10 bg-[#F6F9F2] p-3.5 text-left transition hover:border-[#84CC16]/50 hover:bg-[#EFF5E7] hover:shadow-md hover:shadow-[#3F6212]/10 disabled:cursor-default disabled:hover:shadow-none"
          >
            <div className="flex items-center justify-between gap-2">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#65A30D]/30 bg-[#ECFCCB] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#365314]">
                  <Shield className="h-3 w-3" />
                  Admin
                </span>
              ) : isMember ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/25 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] text-blue-700">
                  <UserCheck className="h-3 w-3" />
                  Jogador
                </span>
              ) : null}
              <ChevronDown className="h-4 w-4 text-[#647468] transition-transform duration-300 group-hover:translate-y-0.5 group-hover:text-[#3F6212]" />
            </div>
            <p className="mt-2 truncate text-[15px] font-extrabold tracking-[-0.03em] text-[#0D1510]">
              {rachaName}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[#647468]">
              {presentCount} presentes · {matchesCount} {matchesCount === 1 ? 'partida' : 'partidas'}
            </p>
          </button>
        )}

        {/* Navegação Principal */}
        <nav className="space-y-1.5" aria-label="Navegação principal">
          <p className="px-3 pb-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#647468]">
            Navegação
          </p>
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const isLiveItem = item.id === 'match' && isMatchRunning;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`sidebar-nav-item ${active ? 'is-active' : ''}`}
              >
                <span className="relative flex items-center justify-center">
                  {item.icon}
                  {isLiveItem && (
                    <span className="sync-dot-wrap absolute -right-1 -top-1 text-emerald-700">
                      <span className="sync-dot-pulse" />
                      <span className="sync-dot" />
                    </span>
                  )}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-extrabold ${
                      isLiveItem
                        ? 'bg-emerald-700 text-white'
                        : active
                        ? 'bg-[#10160A]/[0.12] text-[#10160A]'
                        : 'bg-[#0D1510]/[0.06] text-[#46544A]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rodapé de Utilitários */}
      <div className="space-y-2.5 border-t border-[#0D1510]/[0.08] pt-4">
        {isAdmin && onCopyShareLink && (
          <button
            type="button"
            onClick={onCopyShareLink}
            className="rp-btn-secondary flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-3 text-xs"
          >
            <Link2 className="h-3.5 w-3.5 text-[#3F6212]" />
            Copiar link de leitura
          </button>
        )}

        {isViewer &&
          (isLoggedIn ? (
            <button
              type="button"
              onClick={onBackToMyRachas}
              className="rp-btn-primary flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-3 text-xs"
            >
              Voltar aos meus rachas
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rp-btn-primary flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-3 text-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              Entrar na conta
            </button>
          ))}

        <button
          type="button"
          onClick={onRetrySync}
          title={syncMeta.hint}
          aria-label={`${syncMeta.label}. ${syncMeta.hint}`}
          className={`sync-pill w-full justify-center ${syncMeta.tone}`}
        >
          {syncStatus === 'saving' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : syncStatus === 'offline' ? (
            <CloudOff className="h-3.5 w-3.5" />
          ) : (
            <span className="sync-dot-wrap">
              {isLivePill && <span className="sync-dot-pulse" />}
              <span className="sync-dot" />
            </span>
          )}
          <span>{syncMeta.label}</span>
        </button>
      </div>
    </aside>
  );
};
