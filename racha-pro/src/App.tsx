import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { AuthScreen } from './components/auth/AuthScreen';
import { FirstRachaScreen } from './components/auth/FirstRachaScreen';
import { RachasModal } from './components/auth/RachasModal';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { MatchTab } from './components/match/MatchTab';
import { PlayersTab } from './components/players/PlayersTab';
import { SortTab } from './components/sort/SortTab';
import { StatsTab } from './components/stats/StatsTab';
import { BrandMark } from './components/ui/BrandMark';
import { useToast } from './components/ui/Toast';
import { useAuth } from './hooks/useAuth';
import {
  buildShareUrl,
  clearShareCodeFromUrl,
  getShareCodeFromUrl,
  setShareCodeInUrl,
  useOwnedRachas,
  useSharedRacha,
} from './hooks/useRachas';
import { useRachaStore } from './hooks/useRachaStore';
import { RachaRecord, TabId } from './types/racha';
import { copyText } from './utils/clipboard';

interface RachaWorkspaceProps {
  racha: RachaRecord;
  readOnly: boolean;
  isLoggedIn: boolean;
  onOpenRachas?: () => void;
  onOpenAuth?: () => void;
  onBackToMyRachas?: () => void;
  onSignOut?: () => void;
}

function RachaWorkspace({
  racha,
  readOnly,
  isLoggedIn,
  onOpenRachas,
  onOpenAuth,
  onBackToMyRachas,
  onSignOut,
}: RachaWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>(readOnly ? 'match' : 'players');
  const toast = useToast();
  const store = useRachaStore({
    rachaId: racha.id,
    shareCode: racha.share_code,
    initialData: racha.data,
    readOnly,
  });
  const { state } = store;

  // Se o link de leitura abrir sem times sorteados ainda, começa na aba Elenco
  const initializedTabRef = useRef(false);
  useEffect(() => {
    if (initializedTabRef.current) return;
    initializedTabRef.current = true;
    if (readOnly && state.teams.length === 0) {
      setActiveTab('players');
    }
  }, [readOnly, state.teams.length]);

  // Aviso discreto quando outro aparelho altera os dados (tempo real)
  const lastTick = useRef(store.remoteUpdateTick);
  useEffect(() => {
    if (store.remoteUpdateTick !== lastTick.current) {
      lastTick.current = store.remoteUpdateTick;
      toast.show(
        readOnly ? 'Placar atualizado ao vivo' : 'Atualizado por outro aparelho',
        'info'
      );
    }
  }, [store.remoteUpdateTick, toast, readOnly]);

  const handleCopyShareLink = async () => {
    if (!racha.is_public) {
      toast.show('Link de leitura está pausado. Reative em Meus Rachas.', 'info');
      return;
    }
    const ok = await copyText(buildShareUrl(racha.share_code));
    toast.show(
      ok ? 'Link de leitura copiado! Envie no grupo.' : 'Não foi possível copiar o link',
      ok ? 'success' : 'error'
    );
  };

  const presentCount = state.players.filter((p) => p.present).length;
  const sortLabel = state.settings.sortMode === 'balanced' ? 'EQUILIBRADO' : 'ALEATÓRIO';
  const pageIntro: Record<TabId, { eyebrow: string; title: string; description: string }> = readOnly
    ? {
        players: {
          eyebrow: `ELENCO · ${presentCount} PRESENTES`,
          title: 'Quem está na quadra hoje',
          description: 'Lista de presença atualizada ao vivo pelo organizador.',
        },
        sort: {
          eyebrow: `TIMES · ${state.teams.length} EQUIPES`,
          title: 'Times de hoje',
          description: 'Confira a divisão dos coletes e a ordem da fila.',
        },
        match: {
          eyebrow: 'AO VIVO · SOMENTE LEITURA',
          title: 'Placar em campo',
          description: 'Acompanhe o placar e os lances ao vivo.',
        },
        stats: {
          eyebrow: `NÚMEROS · ${state.history.length} PARTIDAS`,
          title: 'Quem decidiu o racha',
          description: 'Artilharia, garçons, goleiros e histórico completo.',
        },
      }
    : {
        players: {
          eyebrow: `ELENCO · ${presentCount} PRESENTES`,
          title: 'Quem está na quadra hoje',
          description: 'Marque quem chegou e deixe o racha pronto para sortear.',
        },
        sort: {
          eyebrow: `SORTEIO · ${sortLabel}`,
          title: 'Times de hoje',
          description: 'Equilibre os coletes e ajuste qualquer jogador com um toque.',
        },
        match: {
          eyebrow: 'AO VIVO',
          title: 'Placar em campo',
          description: 'Controle o cronômetro, registre os gols e gire a fila.',
        },
        stats: {
          eyebrow: `NÚMEROS · ${state.history.length} PARTIDAS`,
          title: 'Quem decidiu o racha',
          description: 'Artilharia, assistências, card de Stories e resumo pro grupo.',
        },
      };
  const intro = pageIntro[activeTab];

  return (
    <div className="min-h-screen overflow-x-hidden pb-24 text-[#F4F7F2]">
      <Header
        rachaName={racha.name}
        presentCount={presentCount}
        matchesCount={state.history.length}
        syncStatus={store.syncStatus}
        isMatchRunning={state.activeMatch.isRunning}
        readOnly={readOnly}
        isLoggedIn={isLoggedIn}
        onRetrySync={store.retrySync}
        onOpenRachas={onOpenRachas}
        onCopyShareLink={readOnly ? undefined : () => void handleCopyShareLink()}
        onOpenAuth={onOpenAuth}
        onBackToMyRachas={onBackToMyRachas}
      />

      <main className="mx-auto max-w-2xl px-4 pt-5 sm:px-6 sm:pt-7">
        {store.authExpired && !readOnly && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#FBBF24]/40 bg-[#FBBF24]/10 px-4 py-3 text-xs text-[#FDE68A]">
            <span>Sua sessão expirou e as alterações estão salvas só neste aparelho.</span>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-[40px] shrink-0 rounded-xl bg-[#FBBF24] px-3 text-xs font-extrabold text-[#1A1405]"
              >
                Entrar de novo
              </button>
            )}
          </div>
        )}

        {store.linkRevoked && readOnly && (
          <div className="mb-4 rounded-2xl border border-[#FBBF24]/40 bg-[#FBBF24]/10 px-4 py-3 text-xs text-[#FDE68A]">
            Este link foi pausado ou alterado pelo organizador. Peça o novo link no grupo para
            continuar recebendo atualizações.
          </div>
        )}

        {activeTab !== 'match' && (
          <section className="page-intro">
            <p className="page-eyebrow">{intro.eyebrow}</p>
            <h2>{intro.title}</h2>
            <p>{intro.description}</p>
          </section>
        )}
        <div key={activeTab} className="animate-tab-in">
          {activeTab === 'players' && (
            <PlayersTab
              players={state.players}
              readOnly={readOnly}
              onAddPlayer={store.addPlayer}
              onTogglePresence={store.togglePresence}
              onSetAllPresence={store.setAllPresence}
              onUpdatePlayer={store.updatePlayer}
              onRemovePlayer={store.removePlayer}
              onLoadMockPlayers={store.loadMockPlayers}
            />
          )}

          {activeTab === 'sort' && (
            <SortTab
              players={state.players}
              teams={state.teams}
              playersPerTeam={state.settings.playersPerTeam}
              sortMode={state.settings.sortMode}
              readOnly={readOnly}
              onUpdateSettings={store.updateSettings}
              onRunSort={store.runTeamSort}
              onSwapPlayers={store.swapPlayersBetweenTeams}
              onRenameTeam={store.renameTeam}
              onSetTeamColor={store.setTeamColor}
              onAddPlayer={store.addPlayer}
              onAddPlayerToTeam={store.addPlayerToTeam}
              onGoToMatch={() => setActiveTab('match')}
            />
          )}

          {activeTab === 'match' && (
            <MatchTab
              activeMatch={state.activeMatch}
              teams={state.teams}
              players={state.players}
              durationSeconds={state.settings.matchDurationSeconds}
              matchNumber={state.history.length + 1}
              readOnly={readOnly}
              onToggleTimer={store.toggleTimer}
              onResetTimer={store.resetTimer}
              onAddOneMinute={store.addOneMinute}
              onChangeDuration={store.setMatchDurationMinutes}
              onSetMatchup={store.setMatchup}
              onRegisterGoal={store.registerGoal}
              onRemoveEvent={store.removeGoalEvent}
              onFinishMatch={store.finishMatchAndRotate}
              onGoToSort={() => setActiveTab('sort')}
            />
          )}

          {activeTab === 'stats' && (
            <StatsTab
              rachaName={racha.name}
              players={state.players}
              history={state.history}
              allTimeStats={state.allTimeStats}
              archivedDays={state.archivedDays}
              archivedMatches={state.archivedMatches}
              readOnly={readOnly}
              onArchiveDay={store.archiveDay}
              onResetDay={store.resetDayStats}
              onResetAllTime={store.resetAllTimeStats}
            />
          )}
        </div>
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMatchRunning={state.activeMatch.isRunning}
      />
    </div>
  );
}

function FullscreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center text-[#C9D3C4]">
      <BrandMark size="lg" />
      <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-[0.04em] text-[#879287]">
        <Loader2 className="h-4 w-4 animate-spin text-[#BEF264]" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function App() {
  const [shareCode, setShareCode] = useState<string | null>(() => getShareCodeFromUrl());
  const [wantsAuth, setWantsAuth] = useState(false);
  const [showRachasModal, setShowRachasModal] = useState(false);
  const toast = useToast();

  const auth = useAuth();
  const owned = useOwnedRachas(auth.user?.id ?? null);
  const shared = useSharedRacha(shareCode, auth.user?.id ?? null);

  useEffect(() => {
    const onPopState = () => setShareCode(getShareCodeFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (auth.user) setWantsAuth(false);
  }, [auth.user]);

  const openShareCode = (code: string) => {
    setShareCodeInUrl(code);
    setShareCode(code);
    setWantsAuth(false);
  };

  const exitShareMode = () => {
    clearShareCodeFromUrl();
    setShareCode(null);
  };

  // Fluxo de redefinição de senha (quando o usuário clica no link de recuperação por e-mail)
  if (auth.isPasswordRecovery && auth.user) {
    return (
      <ResetPasswordScreen
        userEmail={auth.user.email ?? ''}
        onUpdatePassword={async (newPassword) => {
          const res = await auth.updatePassword(newPassword);
          if (!res.error) toast.show('Senha atualizada com sucesso!');
          return res;
        }}
        onCancel={auth.cancelPasswordRecovery}
        onSignOut={() => void auth.signOut()}
      />
    );
  }

  // Tela de login solicitada manualmente a partir de um link somente leitura
  if (wantsAuth && !auth.user) {
    return (
      <AuthScreen
        isConfigured={auth.isConfigured}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onResetPassword={auth.resetPassword}
        onOpenShareCode={openShareCode}
        onCancel={shareCode ? () => setWantsAuth(false) : undefined}
      />
    );
  }

  // Modo link compartilhado (?racha=<share_code>)
  if (shareCode) {
    if (shared.loading || auth.loading) {
      return <FullscreenLoader label="Carregando racha..." />;
    }

    if (shared.notFound || shared.error || !shared.racha) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center text-[#F4F7F2]">
          <div className="rp-card w-full max-w-sm space-y-4 rounded-[28px] p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F87171]/15 text-[#F87171]">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
                {shared.notFound ? 'Racha não encontrado' : 'Erro ao abrir o racha'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#879287]">
                {shared.notFound
                  ? 'Verifique se o link está completo ou se o organizador pausou o compartilhamento.'
                  : shared.error || 'Não foi possível carregar este racha agora.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void shared.reload()}
                className="rp-btn-secondary flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
              </button>
              <button
                type="button"
                onClick={exitShareMode}
                className="rp-btn-primary flex min-h-[44px] items-center justify-center rounded-2xl text-xs"
              >
                {auth.user ? 'Meus rachas' : 'Fazer login'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const ownedMatch = owned.rachas.find((r) => r.id === shared.racha?.id);
    const isOwner = Boolean(
      auth.user &&
        (shared.racha.is_owner === true ||
          Boolean(ownedMatch) ||
          (shared.racha.owner_id && auth.user.id === shared.racha.owner_id))
    );
    const activeRacha = isOwner ? ownedMatch ?? shared.racha : shared.racha;

    return (
      <>
        <RachaWorkspace
          key={activeRacha.id}
          racha={activeRacha}
          readOnly={!isOwner}
          isLoggedIn={Boolean(auth.user)}
          onOpenRachas={isOwner ? () => setShowRachasModal(true) : undefined}
          onOpenAuth={() => setWantsAuth(true)}
          onBackToMyRachas={exitShareMode}
          onSignOut={() => void auth.signOut()}
        />

        {isOwner && auth.user && showRachasModal && (
          <RachasModal
            userEmail={auth.user.email ?? ''}
            rachas={owned.rachas}
            activeRachaId={activeRacha.id}
            onSelect={(id) => {
              owned.selectRacha(id);
              exitShareMode();
            }}
            onCreate={async (name) => {
              const res = await owned.createRacha(name);
              if (res.racha) exitShareMode();
              return res;
            }}
            onRename={owned.renameRacha}
            onTogglePublic={owned.setRachaPublic}
            onRegenerateShareCode={async (id) => {
              const res = await owned.regenerateShareCode(id);
              if (res.shareCode && id === activeRacha.id) {
                setShareCodeInUrl(res.shareCode);
                setShareCode(res.shareCode);
              }
              return res;
            }}
            onDelete={async (id) => {
              const res = await owned.deleteRacha(id);
              if (!res.error && id === activeRacha.id) exitShareMode();
              return res;
            }}
            onSignOut={() => void auth.signOut()}
            onClose={() => setShowRachasModal(false)}
          />
        )}
      </>
    );
  }

  // Modo conta (sem ?racha= na URL)
  if (auth.loading) {
    return <FullscreenLoader label="Verificando sua sessão..." />;
  }

  if (!auth.user) {
    return (
      <AuthScreen
        isConfigured={auth.isConfigured}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onResetPassword={auth.resetPassword}
        onOpenShareCode={openShareCode}
      />
    );
  }

  if (owned.loading && owned.rachas.length === 0) {
    return <FullscreenLoader label="Carregando seus rachas..." />;
  }

  if (owned.error && owned.rachas.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center text-[#F4F7F2]">
        <div className="rp-card w-full max-w-md space-y-4 rounded-[28px] p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F87171]/15 text-[#F87171]">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#F7FAEF]">
              Erro ao carregar seus rachas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#879287]">{owned.error}</p>
            <p className="mt-2 text-[11px] text-[#879287]">
              Certifique-se de ter executado o script{' '}
              <code className="font-mono text-[#BEF264]">supabase/auth_rachas.sql</code> no SQL
              Editor do Supabase.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void owned.reload()}
              className="rp-btn-primary flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className="rp-btn-secondary flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-xs"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (owned.rachas.length === 0) {
    return (
      <FirstRachaScreen
        userEmail={auth.user.email ?? ''}
        onCreate={(name, initialData) => owned.createRacha(name, initialData)}
        onSignOut={() => void auth.signOut()}
      />
    );
  }

  const activeRacha = owned.selectedRacha ?? owned.rachas[0];

  return (
    <>
      <RachaWorkspace
        key={activeRacha.id}
        racha={activeRacha}
        readOnly={false}
        isLoggedIn={true}
        onOpenRachas={() => setShowRachasModal(true)}
        onSignOut={() => void auth.signOut()}
      />

      {showRachasModal && (
        <RachasModal
          userEmail={auth.user.email ?? ''}
          rachas={owned.rachas}
          activeRachaId={activeRacha.id}
          onSelect={owned.selectRacha}
          onCreate={(name) => owned.createRacha(name)}
          onRename={owned.renameRacha}
          onTogglePublic={owned.setRachaPublic}
          onRegenerateShareCode={owned.regenerateShareCode}
          onDelete={owned.deleteRacha}
          onSignOut={() => void auth.signOut()}
          onClose={() => setShowRachasModal(false)}
        />
      )}
    </>
  );
}

export default App;
