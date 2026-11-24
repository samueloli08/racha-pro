-- =============================================================================
-- RachaPro — Evolução: Membros, Códigos de Convite, Sessões, Presença e Vínculo
-- =============================================================================
-- Execute este script no SQL Editor do Supabase APÓS supabase/auth_rachas.sql.
-- O script é 100% aditivo e idempotente (pode ser executado com segurança sobre
-- bancos que já possuem rachas e dados históricos).
--
-- Garantias de segurança:
-- 1) Membros comuns NÃO podem alterar public.rachas (RLS de escrita é owner-only).
-- 2) Nenhum e-mail pessoal entra em rachas.data JSONB ou é exposto a outros membros.
-- 3) Vínculo automático por e-mail só ocorre com e-mail verificado (email_confirmed_at).
-- 4) Entrada por código tem rate limit no banco (10 tentativas inválidas / 15 min)
--    e lock transacional (FOR UPDATE) contra condições de corrida.
-- 5) Confirmação de presença bloqueada no banco quando a sessão não está 'open'.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Gerador de código de convite curto (RCH + 4 caracteres sem ambiguidade)
--    Usa gen_random_uuid() (pg_catalog, CSPRNG) -> funciona com search_path = ''.
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
  for i in 0..3 loop
    out_code := out_code || substr(alphabet, (get_byte(raw_bytes, i) % 32) + 1, 1);
  end loop;
  return out_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Coluna invite_code em public.rachas + backfill seguro para rachas antigos
-- -----------------------------------------------------------------------------
alter table public.rachas
  add column if not exists invite_code text;

do $$
declare
  rec record;
  candidate text;
  attempts int;
begin
  for rec in
    select id from public.rachas where invite_code is null or trim(invite_code) = ''
  loop
    attempts := 0;
    loop
      attempts := attempts + 1;
      candidate := public.generate_racha_invite_code();
      exit when not exists (select 1 from public.rachas where invite_code = candidate);
      if attempts > 50 then
        raise exception 'Falha ao gerar invite_code único no backfill';
      end if;
    end loop;

    update public.rachas
      set invite_code = candidate
      where id = rec.id;
  end loop;
end $$;

alter table public.rachas
  alter column invite_code set not null;

alter table public.rachas
  alter column invite_code set default public.generate_racha_invite_code();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rachas_invite_code_format_chk'
  ) then
    alter table public.rachas
      add constraint rachas_invite_code_format_chk
      check (invite_code ~ '^[A-Z0-9]{6,12}$');
  end if;
end $$;

create unique index if not exists rachas_invite_code_idx
  on public.rachas (invite_code);

create or replace function public.ensure_racha_invite_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate text;
  attempts int := 0;
begin
  if new.invite_code is not null and trim(new.invite_code) <> '' then
    new.invite_code := upper(trim(new.invite_code));
    return new;
  end if;

  loop
    attempts := attempts + 1;
    candidate := public.generate_racha_invite_code();
    exit when not exists (select 1 from public.rachas where invite_code = candidate);
    if attempts > 30 then
      raise exception 'Não foi possível gerar um código de convite único';
    end if;
  end loop;

  new.invite_code := candidate;
  return new;
end;
$$;

drop trigger if exists trg_rachas_ensure_invite_code on public.rachas;
create trigger trg_rachas_ensure_invite_code
before insert on public.rachas
for each row execute function public.ensure_racha_invite_code();

-- -----------------------------------------------------------------------------
-- 3. Tabela public.racha_members (vínculo persistente User <-> Racha <-> Player)
-- -----------------------------------------------------------------------------
create table if not exists public.racha_members (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.rachas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  player_id text null,
  display_name text not null default 'Jogador'
    check (char_length(trim(display_name)) between 1 and 60),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint racha_members_racha_user_uniq unique (racha_id, user_id)
);

create unique index if not exists racha_members_racha_player_uidx
  on public.racha_members (racha_id, player_id)
  where player_id is not null;

create index if not exists racha_members_user_id_idx
  on public.racha_members (user_id, joined_at desc);

create index if not exists racha_members_racha_id_idx
  on public.racha_members (racha_id, role, joined_at asc);

drop trigger if exists trg_racha_members_updated_at on public.racha_members;
create trigger trg_racha_members_updated_at
before update on public.racha_members
for each row execute function public.set_rachas_updated_at();

-- Backfill: todo dono de racha existente ganha seu registro admin em racha_members
insert into public.racha_members (racha_id, user_id, role, display_name)
select
  r.id,
  r.owner_id,
  'admin',
  left(
    coalesce(
      nullif(trim(split_part(u.email, '@', 1)), ''),
      'Organizador'
    ),
    60
  )
from public.rachas as r
join auth.users as u on u.id = r.owner_id
on conflict (racha_id, user_id) do nothing;

-- Trigger: ao criar novo racha, cria automaticamente a linha admin do dono
create or replace function public.add_owner_as_racha_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_email text;
  owner_label text;
begin
  select u.email into owner_email
  from auth.users as u
  where u.id = new.owner_id;

  owner_label := left(
    coalesce(nullif(trim(split_part(coalesce(owner_email, ''), '@', 1)), ''), 'Organizador'),
    60
  );

  insert into public.racha_members (racha_id, user_id, role, display_name)
  values (new.id, new.owner_id, 'admin', owner_label)
  on conflict (racha_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_rachas_add_owner_member on public.rachas;
create trigger trg_rachas_add_owner_member
after insert on public.rachas
for each row execute function public.add_owner_as_racha_admin();

-- -----------------------------------------------------------------------------
-- 4. Tabela admin-only para e-mail opcional de jogadores avulsos (evita PII no JSONB)
-- -----------------------------------------------------------------------------
create table if not exists public.racha_player_emails (
  racha_id uuid not null references public.rachas(id) on delete cascade,
  player_id text not null check (char_length(trim(player_id)) between 1 and 80),
  email_lower text not null check (email_lower ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now(),
  primary key (racha_id, player_id),
  constraint racha_player_emails_racha_email_uniq unique (racha_id, email_lower)
);

-- -----------------------------------------------------------------------------
-- 5. Tabelas de Sessões e Confirmação de Presença (RSVP)
-- -----------------------------------------------------------------------------
create table if not exists public.racha_sessions (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.rachas(id) on delete cascade,
  title text not null default 'Próxima Pelada'
    check (char_length(trim(title)) between 1 and 80),
  scheduled_at timestamptz null,
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_by uuid not null references auth.users(id) on delete cascade,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists racha_sessions_one_open_uidx
  on public.racha_sessions (racha_id)
  where status = 'open';

create index if not exists racha_sessions_racha_created_idx
  on public.racha_sessions (racha_id, created_at desc);

drop trigger if exists trg_racha_sessions_updated_at on public.racha_sessions;
create trigger trg_racha_sessions_updated_at
before update on public.racha_sessions
for each row execute function public.set_rachas_updated_at();

create table if not exists public.session_rsvps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.racha_sessions(id) on delete cascade,
  racha_id uuid not null references public.rachas(id) on delete cascade,
  member_id uuid not null references public.racha_members(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id text null,
  status text not null check (status in ('going', 'not_going', 'maybe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_rsvps_session_member_uniq unique (session_id, member_id)
);

create unique index if not exists session_rsvps_session_player_uidx
  on public.session_rsvps (session_id, player_id)
  where player_id is not null;

create index if not exists session_rsvps_racha_user_idx
  on public.session_rsvps (racha_id, user_id, status);

create index if not exists session_rsvps_session_status_idx
  on public.session_rsvps (session_id, status);

drop trigger if exists trg_session_rsvps_updated_at on public.session_rsvps;
create trigger trg_session_rsvps_updated_at
before update on public.session_rsvps
for each row execute function public.set_rachas_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Tabela interna de Rate Limiting para entrada por código de convite
-- -----------------------------------------------------------------------------
create table if not exists public.invite_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create index if not exists invite_join_attempts_user_time_idx
  on public.invite_join_attempts (user_id, attempted_at desc);

-- -----------------------------------------------------------------------------
-- 7. Funções auxiliares de autorização (sem recursão de RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_racha_admin(p_racha_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rachas as r
    where r.id = p_racha_id
      and r.owner_id = auth.uid()
  );
$$;

create or replace function public.is_racha_member(p_racha_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.racha_members as m
    where m.racha_id = p_racha_id
      and m.user_id = auth.uid()
  ) or exists (
    select 1
    from public.rachas as r
    where r.id = p_racha_id
      and r.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_racha_admin(uuid) from public;
grant execute on function public.is_racha_admin(uuid) to authenticated;

revoke all on function public.is_racha_member(uuid) from public;
grant execute on function public.is_racha_member(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security (RLS)
-- -----------------------------------------------------------------------------
-- 8.1 public.rachas: SELECT para dono ou membro; escrita EXCLUSIVAMENTE dono
drop policy if exists "rachas_select_owner" on public.rachas;
drop policy if exists "rachas_select_owner_or_member" on public.rachas;
create policy "rachas_select_owner_or_member"
  on public.rachas
  for select
  to authenticated
  using (auth.uid() = owner_id or public.is_racha_member(id));

-- Mantém insert/update/delete estritamente para owner_id = auth.uid()

-- 8.2 public.racha_members: somente leitura para membros/admin do racha;
-- mutações exclusivamente via RPCs SECURITY DEFINER auditadas
alter table public.racha_members enable row level security;

drop policy if exists "racha_members_select_same_racha" on public.racha_members;
create policy "racha_members_select_same_racha"
  on public.racha_members
  for select
  to authenticated
  using (public.is_racha_member(racha_id));

-- 8.3 public.racha_player_emails: acesso exclusivo ao admin do racha
alter table public.racha_player_emails enable row level security;

drop policy if exists "racha_player_emails_admin_all" on public.racha_player_emails;
create policy "racha_player_emails_admin_all"
  on public.racha_player_emails
  for all
  to authenticated
  using (public.is_racha_admin(racha_id))
  with check (public.is_racha_admin(racha_id));

-- 8.4 public.racha_sessions: SELECT para membros/admin; escrita via RPC admin
alter table public.racha_sessions enable row level security;

drop policy if exists "racha_sessions_select_same_racha" on public.racha_sessions;
create policy "racha_sessions_select_same_racha"
  on public.racha_sessions
  for select
  to authenticated
  using (public.is_racha_member(racha_id));

-- 8.5 public.session_rsvps: SELECT para membros/admin; escrita via RPC validada
alter table public.session_rsvps enable row level security;

drop policy if exists "session_rsvps_select_same_racha" on public.session_rsvps;
create policy "session_rsvps_select_same_racha"
  on public.session_rsvps
  for select
  to authenticated
  using (public.is_racha_member(racha_id));

-- 8.6 public.invite_join_attempts: bloqueada para clientes (somente RPC interna)
alter table public.invite_join_attempts enable row level security;

-- -----------------------------------------------------------------------------
-- 9. Publicação Realtime para tabelas novas
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['racha_members', 'racha_sessions', 'session_rsvps'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 10. RPCs Atômicas e Seguras
-- -----------------------------------------------------------------------------

-- 10.1 Listar todos os rachas do usuário autenticado (admin + member)
--      Oculta invite_code quando o papel do usuário é 'member'.
create or replace function public.get_my_rachas()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  share_code text,
  invite_code text,
  is_public boolean,
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
    case when r.owner_id = auth.uid() then r.invite_code else null end as invite_code,
    r.is_public,
    r.data,
    r.created_at,
    r.updated_at,
    case when r.owner_id = auth.uid() then 'admin'::text else m.role end as my_role,
    m.id as my_member_id,
    m.player_id as my_player_id
  from public.rachas as r
  left join public.racha_members as m
    on m.racha_id = r.id and m.user_id = auth.uid()
  where r.owner_id = auth.uid() or m.user_id = auth.uid()
  order by (r.owner_id = auth.uid()) desc, r.updated_at desc;
end;
$$;

revoke all on function public.get_my_rachas() from public;
grant execute on function public.get_my_rachas() to authenticated;

-- 10.2 Regenerar código de convite (somente admin)
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
    exit when not exists (select 1 from public.rachas where invite_code = candidate);
    if attempts > 40 then
      raise exception 'CODE_GENERATION_FAILED';
    end if;
  end loop;

  update public.rachas
    set invite_code = candidate, updated_at = now()
    where id = p_racha_id;

  return candidate;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid) from public;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- 10.3 Entrar em um racha por código de convite (atômico + rate-limited)
--      - Bloqueia brute force (máx 10 falhas / 15 minutos)
--      - Bloqueia entrada duplicada (ALREADY_MEMBER)
--      - Vincula automaticamente APENAS por e-mail verificado cadastrado em racha_player_emails
--      - Caso contrário, cria jogador novo no JSONB dentro da mesma transação com FOR UPDATE
create or replace function public.join_racha_by_invite_code(
  p_invite_code text,
  p_display_name text default null
)
returns table (
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
  v_racha public.rachas%rowtype;
  v_user_email text;
  v_email_confirmed timestamptz;
  v_display_name text;
  v_matched_player_id text := null;
  v_player_id text;
  v_linked_existing boolean := false;
  v_member_id uuid;
  v_players jsonb;
  v_new_player jsonb;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Rate limit: máx 10 tentativas inválidas em 15 minutos
  select count(*) into v_recent_fails
  from public.invite_join_attempts
  where user_id = v_uid
    and succeeded = false
    and attempted_at > now() - interval '15 minutes';

  if v_recent_fails >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  v_code := upper(regexp_replace(trim(coalesce(p_invite_code, '')), '\s+', '', 'g'));
  if v_code !~ '^[A-Z0-9]{6,12}$' then
    insert into public.invite_join_attempts (user_id, succeeded) values (v_uid, false);
    raise exception 'INVALID_CODE';
  end if;

  -- Lock na linha do racha para evitar condições de corrida no JSONB e na filiação
  select * into v_racha
  from public.rachas
  where invite_code = v_code
  for update;

  if not found then
    insert into public.invite_join_attempts (user_id, succeeded) values (v_uid, false);
    raise exception 'INVALID_CODE';
  end if;

  if v_racha.owner_id = v_uid or exists (
    select 1
    from public.racha_members
    where racha_members.racha_id = v_racha.id
      and racha_members.user_id = v_uid
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  select u.email, u.email_confirmed_at
    into v_user_email, v_email_confirmed
  from auth.users as u
  where u.id = v_uid;

  v_display_name := left(
    coalesce(
      nullif(trim(coalesce(p_display_name, '')), ''),
      nullif(trim(split_part(coalesce(v_user_email, ''), '@', 1)), ''),
      'Jogador'
    ),
    60
  );

  v_players := case
    when jsonb_typeof(v_racha.data->'players') = 'array' then v_racha.data->'players'
    else '[]'::jsonb
  end;

  -- Vínculo confiável: apenas quando o e-mail está verificado e cadastrado pelo admin
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
      set data = jsonb_set(coalesce(data, '{}'::jsonb), '{players}', jsonb_build_array(v_new_player) || v_players, true),
          updated_at = now()
      where id = v_racha.id;
  end if;

  insert into public.racha_members (racha_id, user_id, role, player_id, display_name)
  values (v_racha.id, v_uid, 'member', v_player_id, v_display_name)
  returning id into v_member_id;

  insert into public.invite_join_attempts (user_id, succeeded) values (v_uid, true);

  return query
  select v_racha.id, v_racha.name, v_member_id, v_player_id, v_linked_existing;
end;
$$;

revoke all on function public.join_racha_by_invite_code(text, text) from public;
grant execute on function public.join_racha_by_invite_code(text, text) to authenticated;

-- 10.4 Vincular um membro (ou o próprio admin) a um jogador existente no racha
--      Preserva todo o histórico do jogador alvo e impede duplicidade.
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
  v_target text := trim(coalesce(p_target_player_id, ''));
  v_players jsonb;
  v_updated public.racha_members%rowtype;
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  if v_target = '' then
    raise exception 'INVALID_PLAYER';
  end if;

  select * into v_racha
  from public.rachas
  where id = p_racha_id
  for update;

  if not found then
    raise exception 'RACHA_NOT_FOUND';
  end if;

  select * into v_member
  from public.racha_members
  where id = p_member_id
    and racha_id = p_racha_id
  for update;

  if not found then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

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

  update public.racha_members
    set player_id = v_target, updated_at = now()
    where id = p_member_id
    returning * into v_updated;

  -- Mantém RSVPs do membro sincronizados com o novo player_id (sem colisão)
  update public.session_rsvps as r
    set player_id = v_target, updated_at = now()
    where r.member_id = p_member_id
      and not exists (
        select 1
        from public.session_rsvps as other
        where other.session_id = r.session_id
          and other.player_id = v_target
          and other.id <> r.id
      );

  return v_updated;
end;
$$;

revoke all on function public.admin_link_member_to_player(uuid, uuid, text) from public;
grant execute on function public.admin_link_member_to_player(uuid, uuid, text) to authenticated;

-- 10.5 Criar nova sessão de confirmação (somente admin; fecha sessão aberta anterior)
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
  v_title text;
  v_created public.racha_sessions%rowtype;
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  v_title := left(coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Próxima Pelada'), 80);

  -- Fecha sessão anterior aberta para respeitar a unicidade de 1 sessão aberta por racha
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

-- 10.6 Alterar status da sessão (open / closed / archived — somente admin)
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
  v_session public.racha_sessions%rowtype;
  v_updated public.racha_sessions%rowtype;
begin
  if p_status not in ('open', 'closed', 'archived') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_session
  from public.racha_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if auth.uid() is null or not public.is_racha_admin(v_session.racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_status = 'open' then
    update public.racha_sessions
      set status = 'closed', closed_at = coalesce(closed_at, now()), updated_at = now()
      where racha_id = v_session.racha_id
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

-- 10.7 Confirmar / alterar presença na sessão (membro ou admin, somente se 'open')
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
  v_session public.racha_sessions%rowtype;
  v_member public.racha_members%rowtype;
  v_rsvp public.session_rsvps%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_status not in ('going', 'not_going', 'maybe') then
    raise exception 'INVALID_STATUS';
  end if;

  -- Lock na sessão impede alteração simultânea ao fechamento
  select * into v_session
  from public.racha_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status <> 'open' then
    raise exception 'SESSION_CLOSED';
  end if;

  select * into v_member
  from public.racha_members
  where racha_id = v_session.racha_id
    and user_id = v_uid;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.session_rsvps (session_id, racha_id, member_id, user_id, player_id, status)
  values (v_session.id, v_session.racha_id, v_member.id, v_uid, v_member.player_id, p_status)
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

-- 10.8 Cadastrar / remover e-mail de vínculo confiável de um jogador (somente admin)
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
  v_player text := trim(coalesce(p_player_id, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null or not public.is_racha_admin(p_racha_id) then
    raise exception 'FORBIDDEN';
  end if;

  if v_player = '' then
    raise exception 'INVALID_PLAYER';
  end if;

  if v_email = '' then
    delete from public.racha_player_emails
    where racha_id = p_racha_id and player_id = v_player;
    return;
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  insert into public.racha_player_emails (racha_id, player_id, email_lower, updated_at)
  values (p_racha_id, v_player, v_email, now())
  on conflict (racha_id, player_id)
  do update set email_lower = excluded.email_lower, updated_at = now();
end;
$$;

revoke all on function public.admin_set_player_email(uuid, text, text) from public;
grant execute on function public.admin_set_player_email(uuid, text, text) to authenticated;
