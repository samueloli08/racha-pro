import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { translateInviteJoinError } from '../hooks/useRachas';
import {
  generateInviteCode,
  INVITE_CODE_REGEX,
  isValidInviteCode,
  normalizeInviteCode,
} from '../utils/inviteCode';

describe('Código de convite — geração, formato e unicidade', () => {
  it('gera códigos curtos no formato RCH + 6 caracteres sem ambiguidade (30 bits)', () => {
    const generated = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^RCH[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(INVITE_CODE_REGEX.test(code)).toBe(true);
      expect(isValidInviteCode(code)).toBe(true);
      expect(code.slice(3)).not.toMatch(/[0O1I]/);
      generated.add(code);
    }
    expect(generated.size).toBe(500);
  });

  it('normaliza espaços, hífens e minúsculas na entrada do usuário', () => {
    expect(normalizeInviteCode('  rch-4k92x7  ')).toBe('RCH4K92X7');
    expect(isValidInviteCode(' rch 4k92x7 ')).toBe(true);
    expect(isValidInviteCode('RCH4K92')).toBe(true); // retrocompatível com códigos de 7 chars
    expect(isValidInviteCode('abc')).toBe(false);
    expect(isValidInviteCode('RCH_492!')).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
  });

  it('traduz erros críticos de entrada por convite em mensagens claras', () => {
    expect(translateInviteJoinError({ message: 'INVALID_CODE' })).toMatch(/inválido/i);
    expect(translateInviteJoinError({ message: 'ALREADY_MEMBER' })).toMatch(/já participa/i);
    expect(translateInviteJoinError({ message: 'RATE_LIMITED' })).toMatch(/muitas tentativas/i);
    expect(translateInviteJoinError({ message: 'RACHA_FULL' })).toMatch(/limite máximo/i);
    expect(translateInviteJoinError({ message: 'UNAUTHORIZED' })).toMatch(/login/i);
  });
});

describe('Integridade e segurança da migration endurecida (security_hardening.sql)', () => {
  const hardeningPath = path.resolve(process.cwd(), 'supabase/security_hardening.sql');
  const sql = fs.readFileSync(hardeningPath, 'utf8');

  it('remove a tabela legada insegura public.racha_state e move invite_code para racha_invites', () => {
    expect(sql).toContain('drop table if exists public.racha_state');
    expect(sql).toContain('create table if not exists public.racha_invites');
    expect(sql).toContain('alter table public.rachas drop column if exists invite_code');
    expect(sql).toContain('revoke insert, update, delete on public.racha_invites from anon, authenticated');
  });

  it('persiste tentativas falhas de rate limit sem rollback e usa advisory lock', () => {
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("return query select false, 'RATE_LIMITED'::text");
    expect(sql).toContain("return query select false, 'INVALID_CODE'::text");
    expect(sql).toContain("return query select false, 'RACHA_FULL'::text");
    expect(sql).not.toContain('split_part');
  });

  it('implementa optimistic locking (version CAS), FKs compostas e autorização antes de locks', () => {
    expect(sql).toContain('create or replace function public.save_racha_data');
    expect(sql).toContain('session_rsvps_session_racha_fk');
    expect(sql).toContain('session_rsvps_member_racha_user_fk');
    expect(sql).toContain('racha_player_emails_admin_select');
    expect(sql).toContain('revoke insert, update, delete on public.racha_player_emails from anon, authenticated');
    expect(sql).toContain('and public.is_racha_member(s.racha_id)');
    expect(sql).toContain('and public.is_racha_admin(s.racha_id)');
  });
});
