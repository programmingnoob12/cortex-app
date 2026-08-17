-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Supabase already provides `auth.users` (handles the actual login/session
-- machinery). This adds: (1) a `users` table that mirrors auth.users but
-- carries your own app-specific fields like membership status, and (2) a
-- generic key-value table that the storage adapter in database_nback.jsx
-- reads and writes to, mirroring the shape the game already expects.

-- 1. App-level user profile / membership record ----------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  membership_status text not null default 'inactive', -- 'active' | 'inactive'
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- A user can read their own row (needed for the membership check on login).
create policy "users can read own row"
  on public.users for select
  using (auth.uid() = id);

-- Nobody can insert/update/delete from the client — only your backend
-- (using the service_role key, which bypasses RLS) should create/update
-- these rows, driven by the Stripe webhook. That keeps membership status
-- something only a successful payment can set.

-- 2. Generic key-value store (backs window.storage in the app) -------------
create table public.user_kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  shared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key, shared)
);

alter table public.user_kv enable row level security;

-- A signed-in user can read/write/delete only their own rows (shared=false).
create policy "users manage own kv rows"
  on public.user_kv for all
  using (auth.uid() = user_id and shared = false)
  with check (auth.uid() = user_id and shared = false);

-- If you ever use shared=true keys (e.g. a global leaderboard), you'd add
-- a separate policy allowing broader read access to shared rows, and lock
-- writes to those down to your backend only. Not included here since the
-- app doesn't currently use shared storage.

-- 3. Keep updated_at fresh on writes ----------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_kv_set_updated_at
  before update on public.user_kv
  for each row execute function public.set_updated_at();
