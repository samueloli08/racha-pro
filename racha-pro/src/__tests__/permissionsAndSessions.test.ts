import { describe, expect, it } from 'vitest';
import { RachaSession } from '../types/racha';
import { canModifyRsvp, getRachaPermissions } from '../utils/permissions';

const makeSession = (status: RachaSession['status']): RachaSession => ({
  id: 'sess-1',
  racha_id: 'racha-1',
  title: 'Pelada de Quarta',
  scheduled_at: null,
  status,
  created_by: 'user-admin',
  closed_at: status === 'open' ? null : '2026-11-24T20:00:00Z',
  created_at: '2026-11-24T12:00:00Z',
  updated_at: '2026-11-24T12:00:00Z',
});

describe('Separação de permissões — Admin vs Jogador vs Visitante', () => {
  it('concede controles administrativos completos exclusivamente ao admin', () => {
    const admin = getRachaPermissions('admin', true);
    expect(admin.canManageRacha).toBe(true);
    expect(admin.canEditPlayers).toBe(true);
    expect(admin.canSortTeams).toBe(true);
    expect(admin.canControlMatch).toBe(true);
    expect(admin.canManageSessions).toBe(true);
    expect(admin.canLinkMembers).toBe(true);
    expect(admin.canViewInviteCode).toBe(true);
    expect(admin.canConfirmAttendance).toBe(true);
    expect(admin.canViewPersonalStats).toBe(true);
  });

  it('impede que jogador comum (member) execute ações administrativas', () => {
    const member = getRachaPermissions('member', true);
    expect(member.canManageRacha).toBe(false);
    expect(member.canEditPlayers).toBe(false);
    expect(member.canSortTeams).toBe(false);
    expect(member.canControlMatch).toBe(false);
    expect(member.canManageSessions).toBe(false);
    expect(member.canLinkMembers).toBe(false);
    expect(member.canViewInviteCode).toBe(false);
    // Pode confirmar presença e ver suas estatísticas
    expect(member.canConfirmAttendance).toBe(true);
    expect(member.canViewPersonalStats).toBe(true);
  });

  it('bloqueia ações administrativas e presença para visitante de link público (viewer)', () => {
    const viewer = getRachaPermissions('viewer', false);
    expect(viewer.canManageRacha).toBe(false);
    expect(viewer.canConfirmAttendance).toBe(false);
    expect(viewer.canViewPersonalStats).toBe(false);
    expect(viewer.canViewInviteCode).toBe(false);
  });

  it('desabilita estatísticas pessoais quando não há jogador vinculado', () => {
    expect(getRachaPermissions('member', false).canViewPersonalStats).toBe(false);
    expect(getRachaPermissions('admin', false).canViewPersonalStats).toBe(false);
  });
});

describe('Confirmação de presença — bloqueio após encerramento', () => {
  it('permite resposta de admin e membro quando a sessão está aberta', () => {
    const open = makeSession('open');
    expect(canModifyRsvp('member', open)).toBe(true);
    expect(canModifyRsvp('admin', open)).toBe(true);
    expect(canModifyRsvp('viewer', open)).toBe(false);
  });

  it('bloqueia alterações quando a sessão está fechada, arquivada ou ausente', () => {
    const closed = makeSession('closed');
    const archived = makeSession('archived');
    expect(canModifyRsvp('member', closed)).toBe(false);
    expect(canModifyRsvp('admin', closed)).toBe(false);
    expect(canModifyRsvp('member', archived)).toBe(false);
    expect(canModifyRsvp('member', null)).toBe(false);
  });
});
