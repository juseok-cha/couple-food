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

-- Anyone can insert a new room (needed for room creation)
drop policy if exists "rooms: anyone can create" on rooms;
create policy "rooms: anyone can create"
  on rooms for insert to authenticated
  with check (true);

-- Authenticated users can read rooms (needed to fetch invite_code + returning from insert)
drop policy if exists "rooms: authenticated can read" on rooms;
create policy "rooms: authenticated can read"
  on rooms for select to authenticated
  using (true);

-- ── room_members policies ────────────────────────────────────
-- User can join a room (insert their own membership row)
drop policy if exists "room_members: user can join" on room_members;
create policy "room_members: user can join"
  on room_members for insert to authenticated
  with check (user_id = auth.uid());

-- Authenticated users can read member counts (needed before joining)
drop policy if exists "room_members: authenticated can read" on room_members;
create policy "room_members: authenticated can read"
  on room_members for select to authenticated
  using (true);

-- User can leave a room (delete their own membership row)
drop policy if exists "room_members: user can leave" on room_members;
create policy "room_members: user can leave"
  on room_members for delete to authenticated
  using (user_id = auth.uid());

-- ── foods policies ────────────────────────────────────────────
-- Room members can read foods in their room
drop policy if exists "foods: members can read" on foods;
create policy "foods: members can read"
  on foods for select to authenticated
  using (room_id = get_my_room_id());

-- Room members can add foods to their room
drop policy if exists "foods: members can insert" on foods;
create policy "foods: members can insert"
  on foods for insert to authenticated
  with check (room_id = get_my_room_id());

-- Room members can delete any food in their room
drop policy if exists "foods: members can delete" on foods;
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
