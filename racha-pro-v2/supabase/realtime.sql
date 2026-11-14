-- Execute no SQL Editor do Supabase para habilitar o tempo real da tabela racha_state.
-- (Se a tabela ainda não existir, crie-a primeiro.)

create table if not exists public.racha_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Publica as mudanças da tabela no Supabase Realtime
alter publication supabase_realtime add table public.racha_state;

-- Policies simples (app sem login): ajuste conforme sua necessidade de segurança
alter table public.racha_state enable row level security;
create policy "racha_state_read" on public.racha_state for select using (true);
create policy "racha_state_write" on public.racha_state for insert with check (true);
create policy "racha_state_update" on public.racha_state for update using (true) with check (true);
