import { useState } from 'react';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { MatchTab } from './components/match/MatchTab';
import { PlayersTab } from './components/players/PlayersTab';
import { SortTab } from './components/sort/SortTab';
import { StatsTab } from './components/stats/StatsTab';
import { useRachaStore } from './hooks/useRachaStore';
import { TabId } from './types/racha';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('players');
  const {
    state,
    addPlayer,
    togglePresence,
    removePlayer,
    loadMockPlayers,
    updateSettings,
    runTeamSort,
    swapPlayersBetweenTeams,
    toggleTimer,
    resetTimer,
    addOneMinute,
    setMatchDurationMinutes,
    registerGoal,
    removeGoalEvent,
    finishMatchAndRotate,
    resetDayStats,
  } = useRachaStore();

  const presentCount = state.players.filter((p) => p.present).length;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 text-zinc-100">
      <Header
        presentCount={presentCount}
        matchesCount={state.history.length}
      />

      <main className="mx-auto max-w-lg px-4 pt-4">
        {activeTab === 'players' && (
          <PlayersTab
            players={state.players}
            onAddPlayer={addPlayer}
            onTogglePresence={togglePresence}
            onRemovePlayer={removePlayer}
            onLoadMockPlayers={loadMockPlayers}
          />
        )}

        {activeTab === 'sort' && (
          <SortTab
            players={state.players}
            teams={state.teams}
            playersPerTeam={state.settings.playersPerTeam}
            sortMode={state.settings.sortMode}
            onUpdateSettings={updateSettings}
            onRunSort={runTeamSort}
            onSwapPlayers={swapPlayersBetweenTeams}
            onGoToMatch={() => setActiveTab('match')}
          />
        )}

        {activeTab === 'match' && (
          <MatchTab
            activeMatch={state.activeMatch}
            teams={state.teams}
            players={state.players}
            durationSeconds={state.settings.matchDurationSeconds}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onAddOneMinute={addOneMinute}
            onChangeDuration={setMatchDurationMinutes}
            onRegisterGoal={registerGoal}
            onRemoveEvent={removeGoalEvent}
            onFinishMatch={finishMatchAndRotate}
            onGoToSort={() => setActiveTab('sort')}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            players={state.players}
            history={state.history}
            onResetDay={resetDayStats}
          />
        )}
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
