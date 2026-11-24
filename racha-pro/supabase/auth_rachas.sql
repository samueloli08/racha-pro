-- Execute este script no SQL Editor do Supabase para habilitar e proteger:
-- 1) Login por e-mail e senha vinculado a múltiplos rachas por conta
-- 2) Link compartilhável somente leitura SEM permitir listagem em massa (enumeração)
-- 3) Atualização em tempo real + validação de limites no banco
--
-- Recomendações no painel do Supabase (Produção):
-- - Authentication -> Providers -> Email: habilitado + "Confirm email" ativado
-- - Authentication -> Attack Protection: habilitar proteção contra senhas vazadas
--   (Leaked Password Protection) e Captcha (Turnstile/hCaptcha) se aberto ao público
-- - Se a tabela antiga public.racha_state não for mais usada, remova-a:
--   drop table if exists public.racha_state;

create extension if not exists pgcrypto;

create table if not exists public.rachas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Meu Racha',
  share_code text not null unique,
  is_public boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Constraints de integridade e limite de tamanho (idempotentes para quem já criou a tabela)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rachas_name_length_chk'
  ) then
    alter table public.rachas
      add constraint rachas_name_length_chk
      check (char_length(trim(name)) between 1 and 60);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rachas_share_code_format_chk'
  ) then
    alter table public.rachas
      add constraint rachas_share_code_format_chk
      check (share_code ~ '^[a-z0-9]{6,32}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rachas_data_size_chk'
  ) then
    alter table public.rachas
      add constraint rachas_data_size_chk
      check (pg_column_size(data) <= 262144);
  end if;
end $$;

create index if not exists rachas_owner_id_idx on public.rachas (owner_id, updated_at desc);
create unique index if not exists rachas_share_code_idx on public.rachas (share_code);

-- Trigger com search_path fixo (evita alerta "Function Search Path Mutable")
create or replace function public.set_rachas_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rachas_updated_at on public.rachas;
create trigger trg_rachas_updated_at
before update on public.rachas
for each row execute function public.set_rachas_updated_at();

-- Publica mudanças da tabela no Supabase Realtime (para sync multi-aparelho do dono)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rachas'
  ) then
    alter publication supabase_realtime add table public.rachas;
  end if;
end $$;

-- Row Level Security (RLS):
-- - Apenas o dono autenticado (auth.uid() = owner_id) pode ler diretamente a tabela,
--   criar, editar ou excluir. Isso impede enumeração/scraping via REST API.
-- - Visitantes com o link (?racha=<share_code>) acessam EXCLUSIVAMENTE via RPC abaixo.
alter table public.rachas enable row level security;

drop policy if exists "rachas_select_owner_or_public" on public.rachas;
drop policy if exists "rachas_select_owner" on public.rachas;
create policy "rachas_select_owner"
  on public.rachas
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "rachas_insert_owner" on public.rachas;
create policy "rachas_insert_owner"
  on public.rachas
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "rachas_update_owner" on public.rachas;
create policy "rachas_update_owner"
  on public.rachas
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "rachas_delete_owner" on public.rachas;
create policy "rachas_delete_owner"
  on public.rachas
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- RPC segura para link somente leitura:
-- Exige o share_code exato, retorna no máximo 1 linha e NÃO expõe owner_id.
create or replace function public.get_racha_by_share_code(p_share_code text)
returns table (
  id uuid,
  name text,
  share_code text,
  is_public boolean,
  data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text;
begin
  normalized_code := lower(trim(coalesce(p_share_code, '')));
  if normalized_code !~ '^[a-z0-9]{6,32}$' then
    return;
  end if;

  return query
  select
    r.id,
    r.name,
    r.share_code,
    r.is_public,
    r.data,
    r.created_at,
    r.updated_at,
    (auth.uid() is not null and auth.uid() = r.owner_id) as is_owner
  from public.rachas as r
  where r.share_code = normalized_code
    and (r.is_public = true or (auth.uid() is not null and auth.uid() = r.owner_id))
  limit 1;
end;
$$;

revoke all on function public.get_racha_by_share_code(text) from public;
grant execute on function public.get_racha_by_share_code(text) to anon, authenticated;
