import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, LogOut, RefreshCw, Trophy } from 'lucide-react';
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
  const pageIntro: Record<TabId, { eyebrow: string; title: string; description: string }> = readOnly
    ? {
        players: {
          eyebrow: 'ELENCO DO RACHA',
          title: 'Quem vai jogar?',
          description: 'Acompanhe em tempo real quem está confirmado na lista de presença.',
        },
        sort: {
          eyebrow: 'TIMES SORTEADOS',
          title: 'Escalação em campo.',
          description: 'Veja como ficaram divididos os times e a ordem da fila.',
        },
        match: {
          eyebrow: 'CENTRAL DA PARTIDA',
          title: 'O jogo acontece aqui.',
          description: 'Acompanhe o placar e os gols ao vivo.',
        },
        stats: {
          eyebrow: 'DESEMPENHO',
          title: 'Os números do racha.',
          description: 'Veja quem decide, quem assiste e como anda a temporada.',
        },
      }
    : {
        players: {
          eyebrow: 'GESTÃO DO ELENCO',
          title: 'Quem vai jogar?',
          description: 'Confirme a presença e deixe o racha pronto para começar.',
        },
        sort: {
          eyebrow: 'MONTAGEM DOS TIMES',
          title: 'Equilíbrio em campo.',
          description: 'Monte equipes justas e organize a fila do próximo jogo.',
        },
        match: {
          eyebrow: 'CENTRAL DA PARTIDA',
          title: 'O jogo acontece aqui.',
          description: 'Controle o tempo, registre os gols e acompanhe o placar.',
        },
        stats: {
          eyebrow: 'DESEMPENHO',
          title: 'Os números do racha.',
          description: 'Veja quem decide, quem assiste e como anda a temporada.',
        },
      };
  const intro = pageIntro[activeTab];

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 pb-24 text-zinc-100">
      <Header
        rachaName={racha.name}
        presentCount={presentCount}
        matchesCount={state.history.length}
        syncStatus={store.syncStatus}
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
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <span>Sua sessão expirou e as alterações estão salvas só neste aparelho.</span>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="shrink-0 rounded-xl bg-amber-400 px-3 text-xs font-extrabold text-zinc-950"
              >
                Entrar de novo
              </button>
            )}
          </div>
        )}

        {store.linkRevoked && readOnly && (
          <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center text-zinc-300">
      <div className="brand-mark h-14 w-14 rounded-2xl">
        <Trophy className="h-7 w-7" strokeWidth={2.5} />
      </div>
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin text-lime-300" />
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
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center text-zinc-100">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-[#121914]/95 p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                {shared.notFound ? 'Racha não encontrado' : 'Erro ao abrir o racha'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                {shared.notFound
                  ? 'Verifique se o link está completo ou se o organizador pausou o compartilhamento.'
                  : shared.error || 'Não foi possível carregar este racha agora.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void shared.reload()}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 text-xs font-bold text-zinc-200"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
              </button>
              <button
                type="button"
                onClick={exitShareMode}
                className="flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-br from-lime-200 to-lime-400 text-xs font-extrabold text-zinc-950"
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
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center text-zinc-100">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-[#121914]/95 p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Erro ao carregar seus rachas</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{owned.error}</p>
            <p className="mt-2 text-[11px] text-zinc-500">
              Certifique-se de ter executado o script{' '}
              <code className="font-mono text-lime-300">supabase/auth_rachas.sql</code> no SQL
              Editor do Supabase.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void owned.reload()}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-lime-200 to-lime-400 text-xs font-extrabold text-zinc-950"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 text-xs font-bold text-zinc-300"
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
