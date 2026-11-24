export type TabId = 'players' | 'sort' | 'match' | 'stats';

export type SortMode = 'balanced' | 'random';

export type RotationRule = 'winner_stays' | 'both_leave' | 'team_a_stays' | 'team_b_stays';

export type SyncStatus = 'synced' | 'saving' | 'offline';

export type RankingTab = 'general' | 'goals' | 'assists' | 'wins';

export type RachaRole = 'admin' | 'member' | 'viewer';

export type SessionStatus = 'open' | 'closed' | 'archived';

export type RsvpStatus = 'going' | 'not_going' | 'maybe';

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
  /** Opcionais para compatibilidade com estatísticas arquivadas antes da versão de membros. */
  draws?: number;
  losses?: number;
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

export interface RachaRecord {
  id: string;
  owner_id?: string | null;
  name: string;
  share_code: string;
  /** Código curto de convite (ex.: RCH4K92X7). Visível somente para administradores. */
  invite_code?: string | null;
  is_public: boolean;
  /** Versão incremental para optimistic locking (evita lost updates). */
  version?: number;
  data: unknown;
  created_at: string;
  updated_at: string;
  /** Retornado pela RPC segura de compartilhamento sem expor o owner_id. */
  is_owner?: boolean;
  /** Papel do usuário autenticado neste racha ('admin' | 'member'). */
  my_role?: 'admin' | 'member';
  /** Registro de filiação do usuário autenticado neste racha. */
  my_member_id?: string | null;
  /** ID do Player vinculado ao usuário autenticado neste racha. */
  my_player_id?: string | null;
}

export interface RachaMember {
  id: string;
  racha_id: string;
  user_id: string;
  role: 'admin' | 'member';
  player_id: string | null;
  display_name: string;
  joined_at: string;
  updated_at: string;
}

export interface RachaSession {
  id: string;
  racha_id: string;
  title: string;
  scheduled_at: string | null;
  status: SessionStatus;
  created_by: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRsvp {
  id: string;
  session_id: string;
  racha_id: string;
  member_id: string;
  user_id: string;
  player_id: string | null;
  status: RsvpStatus;
  created_at: string;
  updated_at: string;
}

export interface PlayerPersonalStats {
  playerId: string;
  playerName: string;
  matches: number;
  presences: number;
  goals: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  /** Partidas arquivadas antigas sem detalhe de empate vs. derrota. */
  legacyUnclassifiedMatches: number;
  /** Aproveitamento (0 a 100) baseado em 3 pts por vitória e 1 pt por empate; null se sem jogos classificados. */
  efficiencyPct: number | null;
  goalsPerMatch: number;
  gkMatches: number;
  cleanSheets: number;
  goalsConceded: number;
}
