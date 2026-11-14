import { useEffect, useRef, useState } from 'react';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { MatchTab } from './components/match/MatchTab';
import { PlayersTab } from './components/players/PlayersTab';
import { SortTab } from './components/sort/SortTab';
import { StatsTab } from './components/stats/StatsTab';
import { useToast } from './components/ui/Toast';
import { useRachaStore } from './hooks/useRachaStore';
import { TabId } from './types/racha';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('players');
  const toast = useToast();
  const store = useRachaStore();
  const { state } = store;

  // Aviso discreto quando outro aparelho altera os dados (tempo real)
  const lastTick = useRef(store.remoteUpdateTick);
  useEffect(() => {
    if (store.remoteUpdateTick !== lastTick.current) {
      lastTick.current = store.remoteUpdateTick;
      toast.show('Atualizado por outro aparelho', 'info');
    }
  }, [store.remoteUpdateTick, toast]);

  const presentCount = state.players.filter((p) => p.present).length;
  const pageIntro: Record<TabId, { eyebrow: string; title: string; description: string }> = {
    players: { eyebrow: 'GESTÃO DO ELENCO', title: 'Quem vai jogar?', description: 'Confirme a presença e deixe o racha pronto para começar.' },
    sort: { eyebrow: 'MONTAGEM DOS TIMES', title: 'Equilíbrio em campo.', description: 'Monte equipes justas e organize a fila do próximo jogo.' },
    match: { eyebrow: 'CENTRAL DA PARTIDA', title: 'O jogo acontece aqui.', description: 'Controle o tempo, registre os gols e acompanhe o placar.' },
    stats: { eyebrow: 'DESEMPENHO', title: 'Os números do racha.', description: 'Veja quem decide, quem assiste e como anda a temporada.' },
  };
  const intro = pageIntro[activeTab];

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 pb-24 text-zinc-100">
      <Header
        presentCount={presentCount}
        matchesCount={state.history.length}
        syncStatus={store.syncStatus}
        onRetrySync={store.retrySync}
      />

      <main className="mx-auto max-w-2xl px-4 pt-5 sm:px-6 sm:pt-7">
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

export default App;
