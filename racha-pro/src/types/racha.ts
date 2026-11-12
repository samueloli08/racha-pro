export type TabId = 'players' | 'sort' | 'match' | 'stats';

export type SortMode = 'balanced' | 'random';

export type RotationRule = 'winner_stays' | 'both_leave' | 'team_a_stays' | 'team_b_stays';

export interface Player {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  skill: number; // 1 a 5
  present: boolean;
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

export interface RachaStoreState {
  players: Player[];
  teams: Team[];
  settings: RachaSettings;
  activeMatch: ActiveMatchState;
  history: MatchRecord[];
}
