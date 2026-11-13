export type TabId = 'players' | 'sort' | 'match' | 'stats';

export type SortMode = 'balanced' | 'random';

export type RotationRule = 'winner_stays' | 'both_leave' | 'team_a_stays' | 'team_b_stays';

export type SyncStatus = 'synced' | 'saving' | 'offline';

export type RankingTab = 'general' | 'goals' | 'assists' | 'wins';

export interface Player {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  skill: number; // 1 a 5
  present: boolean;
  /** Ordem de chegada (check-in). Opcional para manter compatibilidade com dados antigos. */
  checkInOrder?: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
}

export interface GoalEvent {
  id: string;
  teamId: string;
  scorerId: string | 'own_goal';
  assistId: string | null;
  minuteFormatted: string;
  timestamp: number;
}

export interface MatchRecord {
  id: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  events: GoalEvent[];
  finishedAt: string;
  // Campos novos (opcionais: partidas antigas não possuem)
  teamAId?: string;
  teamBId?: string;
  teamAPlayerIds?: string[];
  teamBPlayerIds?: string[];
  goalkeeperAId?: string | null;
  goalkeeperBId?: string | null;
  rule?: RotationRule;
}

export interface RachaSettings {
  playersPerTeam: number;
  matchDurationSeconds: number;
  sortMode: SortMode;
}

export interface ActiveMatchState {
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  events: GoalEvent[];
  secondsRemaining: number;
  isRunning: boolean;
}

export interface AllTimePlayerStats {
  name: string;
  goals: number;
  assists: number;
  wins: number;
  matches: number;
  /** Partidas em que o jogador foi o goleiro do time. */
  gkMatches: number;
  cleanSheets: number;
  goalsConceded: number;
}

export interface RachaStoreState {
  players: Player[];
  teams: Team[];
  settings: RachaSettings;
  activeMatch: ActiveMatchState;
  history: MatchRecord[];
  allTimeStats: Record<string, AllTimePlayerStats>;
  checkInCounter: number;
  archivedDays: number;
  archivedMatches: number;
}
