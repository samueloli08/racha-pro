-- =============================================================================
-- RachaPro — Security Hardening Migration (Pós-Auditoria)
-- =============================================================================
-- Execute este script no SQL Editor do Supabase APÓS auth_rachas.sql e
-- members_sessions.sql. O script é 100% idempotente e preserva todos os dados.
--
-- Correções aplicadas:
--  [CRÍTICO] F-01: Rate limit persistente em join_racha_by_invite_code (retorno
--                  estruturado sem rollback) + advisory lock + entropia 30 bits.
--  [ALTO]    F-02: Move invite_code para tabela admin-only public.racha_invites
--                  (fora do supabase_realtime) impedindo vazamento a membros.
--  [ALTO]    F-03: Remove tabela legada insegura public.racha_state.
--  [ALTO]    H-02: Adiciona version bigint + RPC save_racha_data (optimistic lock)
--                  contra lost updates quando novos membros entram no racha.
--  [MÉDIO]   F-04: Validação de autorização ANTES de locks/existência/status.
--  [MÉDIO]   F-05: RLS SELECT-only em racha_player_emails + validação na RPC.
--  [MÉDIO]   F-06: FKs compostas em session_rsvps + limpeza segura de player_id.
--  [MÉDIO]   F-07: Lock no racha pai em sessões (evita deadlock) + limite 200 membros.
--  [MÉDIO]   F-08: Geração server-side SECURITY DEFINER de invite_code.
--  [BAIXO]   F-09: Remove fallback de prefixo de e-mail (PII), sanitiza chars de
--                  controle, revoga PUBLIC de triggers/helpers e limpa attempts antigos.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. [F-03] Remover tabela legada public.racha_state (RLS aberta)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'racha_state'
  ) then
    alter publication supabase_realtime drop table public.racha_state;
  end if;
end $$;

drop table if exists public.racha_state;

-- -----------------------------------------------------------------------------
-- 2. [H-02] Controle de concorrência otimista em public.rachas
-- -----------------------------------------------------------------------------
alter table public.rachas
  add column if not exists version bigint not null default 1;

-- -----------------------------------------------------------------------------
-- 3. [F-01 / F-08] Gerador de invite_code com 30 bits de entropia (RCH + 6 chars)
--    Usa bytes 0..5 de gen_random_uuid() (evitando byte 6 version e byte 8 variant).
-- -----------------------------------------------------------------------------
create or replace function public.generate_racha_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw_bytes bytea;
  out_code text := 'RCH';
  i int;
begin
  raw_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 0..5 loop
    out_code := out_code || substr(alphabet, (get_byte(raw_bytes, i) % 32) + 1, 1);
  end loop;
  return out_code;
end;
$$;

revoke all on function public.generate_racha_invite_code() from public;

-- -----------------------------------------------------------------------------
-- 4. [F-02] Tabela admin-only public.racha_invites (fora do supabase_realtime)
-- -----------------------------------------------------------------------------
create table if not exists public.racha_invites (
  racha_id uuid primary key references public.rachas(id) on delete cascade,
  invite_code text not null unique
    check (invite_code ~ '^[A-Z0-9]{6,16}$'),
  updated_at timestamptz not null default now()
);

create unique index if not exists racha_invites_code_uidx
  on public.racha_invites (invite_code);

alter table public.racha_invites enable row level security;

drop policy if exists "racha_invites_admin_select" on public.racha_invites;
create policy "racha_invites_admin_select"
  on public.racha_invites
  for select
  to authenticated
  using (public.is_racha_admin(racha_id));

revoke insert, update, delete on public.racha_invites from anon, authenticated;

-- Migrar códigos existentes de public.rachas.invite_code -> public.racha_invites
do $$
declare
  rec record;
  candidate text;
  attempts int;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rachas'
      and column_name = 'invite_code'
  ) then
    execute $mig$
      insert into public.racha_invites (racha_id, invite_code)
      select r.id, upper(trim(r.invite_code))
      from public.rachas as r
      where r.invite_code is not null
        and trim(r.invite_code) ~ '^[A-Za-z0-9]{6,16}$'
      on conflict (racha_id) do nothing
    $mig$;
  end if;

  -- Backfill para qualquer racha que ainda não tenha linha em racha_invites
  for rec in
    select r.id
    from public.rachas as r
    left join public.racha_invites as i on i.racha_id = r.id
    where i.racha_id is null
  loop
    attempts := 0;
    loop
      attempts := attempts + 1;
      candidate := public.generate_racha_invite_code();
      exit when not exists (
        select 1 from public.racha_invites where invite_code = candidate
      );
      if attempts > 50 then
        raise exception 'Falha ao gerar invite_code único no backfill';
      end if;
    end loop;

    insert into public.racha_invites (racha_id, invite_code)
    values (rec.id, candidate)
    on conflict (racha_id) do nothing;
  end loop;
end $$;

-- Remover coluna invite_code e trigger antigo de public.rachas (impede vazamento via Realtime/RLS)
drop trigger if exists trg_rachas_ensure_invite_code on public.rachas;
drop function if exists public.ensure_racha_invite_code();
drop index if exists public.rachas_invite_code_idx;
alter table public.rachas drop constraint if exists rachas_invite_code_format_chk;
alter table public.rachas drop column if exists invite_code;

-- Trigger de criação de racha: cria admin em racha_members (sem PII de e-mail) + racha_invites
create or replace function public.add_owner_as_racha_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  attempts int := 0;
begin
  insert into public.racha_members (racha_id, user_id, role, display_name)
  values (new.id, new.owner_id, 'admin', 'Organizador')
  on conflict (racha_id, user_id) do nothing;

  loop
    attempts := attempts + 1;
    candidate := public.generate_racha_invite_code();
    exit when not exists (
      select 1 from public.racha_invites where invite_code = candidate
    );
    if attempts > 40 then
      raise exception 'CODE_GENERATION_FAILED';
    end if;
  end loop;

  insert into public.racha_invites (racha_id, invite_code)
  values (new.id, candidate)
  on conflict (racha_id) do nothing;

  return new;
end;
$$;

revoke all on function public.add_owner_as_racha_admin() from public;
revoke all on function public.set_rachas_updated_at() from public;

-- -----------------------------------------------------------------------------
-- 5. [F-05] Endurecer public.racha_player_emails (SELECT-only + constraints)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'racha_player_emails_email_norm_chk'
  ) then
    alter table public.racha_player_emails
      add constraint racha_player_emails_email_norm_chk
      check (
        email_lower = lower(trim(email_lower))
        and char_length(email_lower) between 5 and 254
      );
  end if;
end $$;

drop policy if exists "racha_player_emails_admin_all" on public.racha_player_emails;
drop policy if exists "racha_player_emails_admin_select" on public.racha_player_emails;
create policy "racha_player_emails_admin_select"
  on public.racha_player_emails
  for select
  to authenticated
  using (public.is_racha_admin(racha_id));

revoke insert, update, delete on public.racha_player_emails from anon, authenticated;

-- Defesa em profundidade: revogar DML direto em tabelas geridas por RPC
revoke insert, update, delete on public.racha_members from anon, authenticated;
revoke insert, update, delete on public.racha_sessions from anon, authenticated;
revoke insert, update, delete on public.session_rsvps from anon, authenticated;
revoke all on public.invite_join_attempts from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. [F-06] FKs compostas e limites em session_rsvps / racha_members
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'racha_members_player_id_len_chk'
  ) then
    alter table public.racha_members
      add constraint racha_members_player_id_len_chk
      check (player_id is null or char_length(player_id) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'session_rsvps_player_id_len_chk'
  ) then
    alter table public.session_rsvps
      add constraint session_rsvps_player_id_len_chk
      check (player_id is null or char_length(player_id) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'racha_sessions_id_racha_uniq'
  ) then
    alter table public.racha_sessions
      add constraint racha_sessions_id_racha_uniq unique (id, racha_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'racha_members_id_racha_user_uniq'
  ) then
    alter table public.racha_members
      add constraint racha_members_id_racha_user_uniq unique (id, racha_id, user_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'session_rsvps_session_racha_fk'
  ) then
    alter table public.session_rsvps
      add constraint session_rsvps_session_racha_fk
      foreign key (session_id, racha_id)
      references public.racha_sessions(id, racha_id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'session_rsvps_member_racha_user_fk'
  ) then
    alter table public.session_rsvps
      add constraint session_rsvps_member_racha_user_fk
      foreign key (member_id, racha_id, user_id)
      references public.racha_members(id, racha_id, user_id) on delete cascade;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. RPCs Endurecidas
-- -----------------------------------------------------------------------------

-- 7.1 get_my_rachas: inclui version e lê invite_code de racha_invites somente p/ admin
drop function if exists public.get_my_rachas();
create or replace function public.get_my_rachas()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  share_code text,
  invite_code text,
  is_public boolean,
  version bigint,
  data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  my_role text,
  my_member_id uuid,
  my_player_id text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  return query
  select
    r.id,
    case when r.owner_id = auth.uid() then r.owner_id else null end as owner_id,
    r.name,
    r.share_code,
    case when r.owner_id = auth.uid() then inv.invite_code else null end as invite_code,
    r.is_public,
    r.version,
    r.data,
    r.created_at,
    r.updated_at,
    case when r.owner_id = auth.uid() then 'admin'::text else m.role end as my_role,
    m.id as my_member_id,
    m.player_id as my_player_id
  from public.rachas as r
  left join public.racha_members as m
    on m.racha_id = r.id and m.user_id = auth.uid()
  left join public.racha_invites as inv
    on inv.racha_id = r.id and r.owner_id = auth.uid()
  where r.owner_id = auth.uid() or m.user_id = auth.uid()
  order by (r.owner_id = auth.uid()) desc, r.updated_at desc;
end;
$$;

revoke all on function public.get_my_rachas() from public;
grant execute on function public.get_my_rachas() to authenticated;

-- 7.2 [H-02] save_racha_data: salvamento atômico com optimistic locking (version CAS)
create or replace function public.save_racha_data(
  p_racha_id uuid,
  p_expected_version bigint,
  p_data jsonb
)
returns table (
  ok boolean,
  conflict boolean,
  version bigint,
  data jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.rachas%rowtype;
  v_next_version bigint;
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_data is null or pg_column_size(p_data) > 262144 then
    raise exception 'PAYLOAD_TOO_LARGE';
  end if;

  select * into v_racha
  from public.rachas
  where id = p_racha_id
  for update;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  if p_expected_version is not null and v_racha.version <> p_expected_version then
    return query
    select false, true, v_racha.version, v_racha.data;
    return;
  end if;

  v_next_version := v_racha.version + 1;

  update public.rachas
    set data = p_data,
        version = v_next_version,
        updated_at = now()
    where id = p_racha_id;

  return query
  select true, false, v_next_version, null::jsonb;
end;
$$;

revoke all on function public.save_racha_data(uuid, bigint, jsonb) from public;
grant execute on function public.save_racha_data(uuid, bigint, jsonb) to authenticated;

-- 7.3 [F-02] regenerate_invite_code: atualiza public.racha_invites (admin-only)
create or replace function public.regenerate_invite_code(p_racha_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  attempts int := 0;
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  loop
    attempts := attempts + 1;
    candidate := public.generate_racha_invite_code();
    exit when not exists (
      select 1 from public.racha_invites where invite_code = candidate
    );
    if attempts > 40 then
      raise exception 'CODE_GENERATION_FAILED';
    end if;
  end loop;

  insert into public.racha_invites (racha_id, invite_code, updated_at)
  values (p_racha_id, candidate, now())
  on conflict (racha_id)
  do update set invite_code = excluded.invite_code, updated_at = now();

  return candidate;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid) from public;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- 7.4 [CRÍTICO F-01 + F-02 + F-07 + F-09] join_racha_by_invite_code
--     Retorna linha estruturada (ok, error_code, ...) em vez de RAISE EXCEPTION
--     para que falhas sejam PERSISTIDAS em invite_join_attempts (rate limit real).
drop function if exists public.join_racha_by_invite_code(text, text);
create or replace function public.join_racha_by_invite_code(
  p_invite_code text,
  p_display_name text default null
)
returns table (
  ok boolean,
  error_code text,
  racha_id uuid,
  racha_name text,
  member_id uuid,
  player_id text,
  linked_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_recent_fails int;
  v_invite_racha_id uuid;
  v_racha public.rachas%rowtype;
  v_member_count int;
  v_user_email text;
  v_email_confirmed timestamptz;
  v_clean_name text;
  v_display_name text;
  v_matched_player_id text := null;
  v_player_id text;
  v_linked_existing boolean := false;
  v_member_id uuid;
  v_players jsonb;
  v_new_player jsonb;
begin
  if v_uid is null then
    return query select false, 'UNAUTHORIZED'::text, null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  -- Serializa tentativas por usuário (elimina TOCTOU no rate limit)
  perform pg_advisory_xact_lock(hashtextextended('invite_join:' || v_uid::text, 0));

  -- Limpeza periódica de tentativas antigas (> 24h)
  delete from public.invite_join_attempts
  where user_id = v_uid
    and attempted_at < now() - interval '1 day';

  select count(*) into v_recent_fails
  from public.invite_join_attempts
  where user_id = v_uid
    and succeeded = false
    and attempted_at > now() - interval '15 minutes';

  if v_recent_fails >= 10 then
    return query select false, 'RATE_LIMITED'::text, null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  v_code := upper(regexp_replace(btrim(coalesce(p_invite_code, ''), E' \t\r\n'), '[\s-]+', '', 'g'));
  if v_code !~ '^[A-Z0-9]{6,16}$' then
    insert into public.invite_join_attempts (user_id, succeeded) values (v_uid, false);
    return query select false, 'INVALID_CODE'::text, null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  select i.racha_id into v_invite_racha_id
  from public.racha_invites as i
  where i.invite_code = v_code;

  if v_invite_racha_id is null then
    insert into public.invite_join_attempts (user_id, succeeded) values (v_uid, false);
    return query select false, 'INVALID_CODE'::text, null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  select * into v_racha
  from public.rachas
  where id = v_invite_racha_id
  for update;

  if not found then
    insert into public.invite_join_attempts (user_id, succeeded) values (v_uid, false);
    return query select false, 'INVALID_CODE'::text, null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  if v_racha.owner_id = v_uid or exists (
    select 1
    from public.racha_members
    where racha_members.racha_id = v_racha.id
      and racha_members.user_id = v_uid
  ) then
    return query select false, 'ALREADY_MEMBER'::text, v_racha.id, v_racha.name, null::uuid, null::text, false;
    return;
  end if;

  -- [F-07] Limite de segurança por racha (evita DoS no limite de 256 KB do JSONB)
  select count(*) into v_member_count
  from public.racha_members
  where racha_members.racha_id = v_racha.id;

  if v_member_count >= 200 then
    return query select false, 'RACHA_FULL'::text, null::uuid, null::text, null::uuid, null::text, false;
    return;
  end if;

  -- [F-09] Sanitização de caracteres de controle; NUNCA usar prefixo de e-mail como nome
  v_clean_name := btrim(regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]]+', '', 'g'), E' \t\r\n');
  v_display_name := left(coalesce(nullif(v_clean_name, ''), 'Jogador'), 60);

  select u.email, u.email_confirmed_at
    into v_user_email, v_email_confirmed
  from auth.users as u
  where u.id = v_uid;

  v_players := case
    when jsonb_typeof(v_racha.data->'players') = 'array' then v_racha.data->'players'
    else '[]'::jsonb
  end;

  -- Vínculo automático APENAS com e-mail verificado cadastrado em racha_player_emails
  if v_email_confirmed is not null and v_user_email is not null then
    select pe.player_id into v_matched_player_id
    from public.racha_player_emails as pe
    where pe.racha_id = v_racha.id
      and pe.email_lower = lower(trim(v_user_email))
      and not exists (
        select 1
        from public.racha_members as m
        where m.racha_id = v_racha.id
          and m.player_id = pe.player_id
      )
      and exists (
        select 1
        from jsonb_array_elements(v_players) as elem
        where elem->>'id' = pe.player_id
      )
    limit 1;
  end if;

  if v_matched_player_id is not null then
    v_player_id := v_matched_player_id;
    v_linked_existing := true;
  else
    v_player_id := 'player-' || replace(gen_random_uuid()::text, '-', '');
    v_new_player := jsonb_build_object(
      'id', v_player_id,
      'name', v_display_name,
      'isGoalkeeper', false,
      'skill', 3,
      'present', false
    );

    update public.rachas
      set data = jsonb_set(
            coalesce(data, '{}'::jsonb),
            '{players}',
            jsonb_build_array(v_new_player) || v_players,
            true
          ),
          version = version + 1,
          updated_at = now()
      where id = v_racha.id;
  end if;

  insert into public.racha_members (racha_id, user_id, role, player_id, display_name)
  values (v_racha.id, v_uid, 'member', v_player_id, v_display_name)
  returning id into v_member_id;

  insert into public.invite_join_attempts (user_id, succeeded) values (v_uid, true);

  return query
  select true, null::text, v_racha.id, v_racha.name, v_member_id, v_player_id, v_linked_existing;
end;
$$;

revoke all on function public.join_racha_by_invite_code(text, text) from public;
grant execute on function public.join_racha_by_invite_code(text, text) to authenticated;

-- 7.5 [F-06] admin_link_member_to_player: suporta desvinculação (NULL) e limpa RSVPs sem colisão
create or replace function public.admin_link_member_to_player(
  p_racha_id uuid,
  p_member_id uuid,
  p_target_player_id text
)
returns public.racha_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.rachas%rowtype;
  v_member public.racha_members%rowtype;
  v_target text := nullif(btrim(coalesce(p_target_player_id, ''), E' \t\r\n'), '');
  v_players jsonb;
  v_updated public.racha_members%rowtype;
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  if v_target is not null and char_length(v_target) > 80 then
    raise exception 'INVALID_PLAYER';
  end if;

  select * into v_racha
  from public.rachas
  where id = p_racha_id
  for update;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_member
  from public.racha_members
  where id = p_member_id
    and racha_id = p_racha_id
  for update;

  if not found then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if v_target is not null then
    v_players := case
      when jsonb_typeof(v_racha.data->'players') = 'array' then v_racha.data->'players'
      else '[]'::jsonb
    end;

    if not exists (
      select 1
      from jsonb_array_elements(v_players) as elem
      where elem->>'id' = v_target
    ) then
      raise exception 'PLAYER_NOT_FOUND';
    end if;

    if exists (
      select 1
      from public.racha_members
      where racha_id = p_racha_id
        and player_id = v_target
        and id <> p_member_id
    ) then
      raise exception 'PLAYER_ALREADY_LINKED';
    end if;
  end if;

  update public.racha_members
    set player_id = v_target, updated_at = now()
    where id = p_member_id
    returning * into v_updated;

  -- Atualiza RSVPs: usa v_target quando livre na sessão, ou limpa (NULL) se já ocupado
  -- (nunca deixa o player_id antigo preso em session_rsvps)
  update public.session_rsvps as r
    set player_id = case
          when v_target is null then null
          when exists (
            select 1
            from public.session_rsvps as other
            where other.session_id = r.session_id
              and other.player_id = v_target
              and other.id <> r.id
          ) then null
          else v_target
        end,
        updated_at = now()
    where r.member_id = p_member_id;

  return v_updated;
end;
$$;

revoke all on function public.admin_link_member_to_player(uuid, uuid, text) from public;
grant execute on function public.admin_link_member_to_player(uuid, uuid, text) to authenticated;

-- 7.6 [F-07 / F-09] create_racha_session: lock no racha pai + sanitização
create or replace function public.create_racha_session(
  p_racha_id uuid,
  p_title text default 'Próxima Pelada',
  p_scheduled_at timestamptz default null
)
returns public.racha_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean text;
  v_title text;
  v_created public.racha_sessions%rowtype;
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  -- Lock no racha pai serializa abertura/fechamento de sessões
  perform 1 from public.rachas where id = p_racha_id for update;

  v_clean := btrim(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]+', '', 'g'), E' \t\r\n');
  v_title := left(coalesce(nullif(v_clean, ''), 'Próxima Pelada'), 80);

  update public.racha_sessions
    set status = 'closed', closed_at = coalesce(closed_at, now()), updated_at = now()
    where racha_id = p_racha_id and status = 'open';

  insert into public.racha_sessions (racha_id, title, scheduled_at, status, created_by)
  values (p_racha_id, v_title, p_scheduled_at, 'open', auth.uid())
  returning * into v_created;

  return v_created;
end;
$$;

revoke all on function public.create_racha_session(uuid, text, timestamptz) from public;
grant execute on function public.create_racha_session(uuid, text, timestamptz) to authenticated;

-- 7.7 [F-04 / F-07] set_racha_session_status: auth ANTES de lock + ordem de lock consistente
create or replace function public.set_racha_session_status(
  p_session_id uuid,
  p_status text
)
returns public.racha_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha_id uuid;
  v_updated public.racha_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_status not in ('open', 'closed', 'archived') then
    raise exception 'INVALID_STATUS';
  end if;

  -- Valida existência + permissão de admin ANTES de adquirir lock (elimina oráculo cross-racha)
  select s.racha_id into v_racha_id
  from public.racha_sessions as s
  where s.id = p_session_id
    and public.is_racha_admin(s.racha_id);

  if v_racha_id is null then
    raise exception 'FORBIDDEN';
  end if;

  -- Ordem consistente de lock: racha pai -> sessões (elimina deadlocks)
  perform 1 from public.rachas where id = v_racha_id for update;

  if p_status = 'open' then
    update public.racha_sessions
      set status = 'closed', closed_at = coalesce(closed_at, now()), updated_at = now()
      where racha_id = v_racha_id
        and status = 'open'
        and id <> p_session_id;
  end if;

  update public.racha_sessions
    set status = p_status,
        closed_at = case when p_status = 'open' then null else coalesce(closed_at, now()) end,
        updated_at = now()
    where id = p_session_id
    returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.set_racha_session_status(uuid, text) from public;
grant execute on function public.set_racha_session_status(uuid, text) to authenticated;

-- 7.8 [F-04 / F-06 / F-10] upsert_session_rsvp: auth ANTES de status/lock + FOR SHARE + sem 23505
create or replace function public.upsert_session_rsvp(
  p_session_id uuid,
  p_status text
)
returns public.session_rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_racha_id uuid;
  v_session public.racha_sessions%rowtype;
  v_member public.racha_members%rowtype;
  v_safe_player_id text;
  v_rsvp public.session_rsvps%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_status not in ('going', 'not_going', 'maybe') then
    raise exception 'INVALID_STATUS';
  end if;

  -- Verifica filiação ANTES de expor existência/status ou adquirir locks
  select s.racha_id into v_racha_id
  from public.racha_sessions as s
  where s.id = p_session_id
    and public.is_racha_member(s.racha_id);

  if v_racha_id is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_session
  from public.racha_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  if v_session.status <> 'open' then
    raise exception 'SESSION_CLOSED';
  end if;

  select * into v_member
  from public.racha_members
  where racha_id = v_racha_id
    and user_id = v_uid
  for share;

  -- Garante consistência caso o owner não tenha linha em racha_members
  if not found then
    if public.is_racha_admin(v_racha_id) then
      insert into public.racha_members (racha_id, user_id, role, display_name)
      values (v_racha_id, v_uid, 'admin', 'Organizador')
      on conflict (racha_id, user_id) do update set updated_at = now()
      returning * into v_member;
    else
      raise exception 'FORBIDDEN';
    end if;
  end if;

  -- Evita colisão 23505 caso outro RSVP legado já detenha o player_id nesta sessão
  v_safe_player_id := v_member.player_id;
  if v_safe_player_id is not null and exists (
    select 1
    from public.session_rsvps as other
    where other.session_id = v_session.id
      and other.player_id = v_safe_player_id
      and other.member_id <> v_member.id
  ) then
    v_safe_player_id := null;
  end if;

  insert into public.session_rsvps (session_id, racha_id, member_id, user_id, player_id, status)
  values (v_session.id, v_session.racha_id, v_member.id, v_uid, v_safe_player_id, p_status)
  on conflict (session_id, member_id)
  do update set
    status = excluded.status,
    player_id = excluded.player_id,
    updated_at = now()
  returning * into v_rsvp;

  return v_rsvp;
end;
$$;

revoke all on function public.upsert_session_rsvp(uuid, text) from public;
grant execute on function public.upsert_session_rsvp(uuid, text) to authenticated;

-- 7.9 [F-05] admin_set_player_email: valida tamanho, existência do jogador e unicidade
create or replace function public.admin_set_player_email(
  p_racha_id uuid,
  p_player_id text,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player text := btrim(coalesce(p_player_id, ''), E' \t\r\n');
  v_email text := lower(btrim(coalesce(p_email, ''), E' \t\r\n'));
  v_players jsonb;
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  if v_player = '' or char_length(v_player) > 80 then
    raise exception 'INVALID_PLAYER';
  end if;

  if v_email = '' then
    delete from public.racha_player_emails
    where racha_id = p_racha_id and player_id = v_player;
    return;
  end if;

  if char_length(v_email) < 5 or char_length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  select case
    when jsonb_typeof(r.data->'players') = 'array' then r.data->'players'
    else '[]'::jsonb
  end into v_players
  from public.rachas as r
  where r.id = p_racha_id;

  if v_players is null or not exists (
    select 1 from jsonb_array_elements(v_players) as elem where elem->>'id' = v_player
  ) then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  begin
    insert into public.racha_player_emails (racha_id, player_id, email_lower, updated_at)
    values (p_racha_id, v_player, v_email, now())
    on conflict (racha_id, player_id)
    do update set email_lower = excluded.email_lower, updated_at = now();
  exception when unique_violation then
    raise exception 'EMAIL_ALREADY_IN_USE';
  end;
end;
$$;

revoke all on function public.admin_set_player_email(uuid, text, text) from public;
grant execute on function public.admin_set_player_email(uuid, text, text) to authenticated;
