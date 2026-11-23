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

create index if not exists rachas_owner_id_idx on public.rachas (owner_id, updated_at desc);
create unique index if not exists rachas_share_code_idx on public.rachas (share_code);


create or replace function public.set_rachas_updated_at()
returns trigger
language plpgsql
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


alter table public.rachas enable row level security;

drop policy if exists "rachas_select_owner_or_public" on public.rachas;
create policy "rachas_select_owner_or_public"
  on public.rachas
  for select
  using (auth.uid() = owner_id or is_public = true);

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
