import { RachaRole, RachaSession } from '../types/racha';

export interface RachaPermissions {
  canManageRacha: boolean;
  canEditPlayers: boolean;
  canSortTeams: boolean;
  canControlMatch: boolean;
  canManageSessions: boolean;
  canLinkMembers: boolean;
  canViewInviteCode: boolean;
  canConfirmAttendance: boolean;
  canViewPersonalStats: boolean;
}

/**
 * Matriz de permissões de interface (espelha as policies RLS e RPCs SECURITY DEFINER).
 * Nota: a segurança real é garantida no PostgreSQL; estas funções controlam a UX coerente.
 */
export function getRachaPermissions(
  role: RachaRole,
  hasLinkedPlayer: boolean
): RachaPermissions {
  const isAdmin = role === 'admin';
  const isMemberOrAdmin = role === 'admin' || role === 'member';

  return {
    canManageRacha: isAdmin,
    canEditPlayers: isAdmin,
    canSortTeams: isAdmin,
    canControlMatch: isAdmin,
    canManageSessions: isAdmin,
    canLinkMembers: isAdmin,
    canViewInviteCode: isAdmin,
    canConfirmAttendance: isMemberOrAdmin,
    canViewPersonalStats: isMemberOrAdmin && hasLinkedPlayer,
  };
}

/** Verifica se o usuário pode alterar resposta de presença em uma sessão específica. */
export function canModifyRsvp(role: RachaRole, session: Pick<RachaSession, 'status'> | null): boolean {
  if (role === 'viewer') return false;
  if (!session) return false;
  return session.status === 'open';
}
