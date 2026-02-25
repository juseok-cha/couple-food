-- ============================================================
-- Couple Food — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── rooms ────────────────────────────────────────────────────
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at  timestamptz default now()
);

-- ── room_members ─────────────────────────────────────────────
create table if not exists room_members (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(room_id, user_id)
);

-- ── foods ─────────────────────────────────────────────────────
create table if not exists foods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  location   text,
  person     text check (person in ('여친', '남친', '둘다')),
  room_id    uuid not null references rooms(id) on delete cascade,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table rooms        enable row level security;
alter table room_members enable row level security;
alter table foods        enable row level security;

-- Helper: returns the room_id for the current user (null if none)
create or replace function get_my_room_id()
returns uuid language sql security definer stable as $$
  select room_id from room_members where user_id = auth.uid() limit 1;
$$;

-- ── rooms policies ───────────────────────────────────────────
-- Anyone can insert a new room (needed for room creation)
create policy "rooms: anyone can create"
  on rooms for insert to authenticated
  with check (true);

-- Only members can read their own room
create policy "rooms: members can read"
  on rooms for select to authenticated
  using (id = get_my_room_id());

-- ── room_members policies ────────────────────────────────────
-- User can join a room (insert their own membership row)
create policy "room_members: user can join"
  on room_members for insert to authenticated
  with check (user_id = auth.uid());

-- User can read members of their own room
create policy "room_members: members can read"
  on room_members for select to authenticated
  using (room_id = get_my_room_id());

-- ── foods policies ────────────────────────────────────────────
-- Room members can read foods in their room
create policy "foods: members can read"
  on foods for select to authenticated
  using (room_id = get_my_room_id());

-- Room members can add foods to their room
create policy "foods: members can insert"
  on foods for insert to authenticated
  with check (room_id = get_my_room_id());

-- Room members can delete any food in their room
create policy "foods: members can delete"
  on foods for delete to authenticated
  using (room_id = get_my_room_id());

-- ============================================================
-- Realtime
-- ============================================================

-- Enable Realtime for the foods table via the Supabase Dashboard:
-- Database → Replication → select "foods" table
-- Or run the following (requires supabase CLI / pg_replication access):
-- alter publication supabase_realtime add table foods;

-- ============================================================
-- Indexes (performance)
-- ============================================================
create index if not exists idx_room_members_user_id on room_members(user_id);
create index if not exists idx_foods_room_id        on foods(room_id);
create index if not exists idx_rooms_invite_code    on rooms(invite_code);
