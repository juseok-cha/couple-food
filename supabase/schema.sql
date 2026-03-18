-- ============================================================
-- Couple Food — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── profiles ──────────────────────────────────────────────────
-- Stores user display name and avatar URL
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text,
  avatar_url  text,
  updated_at  timestamptz default now()
);

-- ── rooms ────────────────────────────────────────────────────
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '우리의 맛집 리스트',
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
  added_by   uuid references auth.users(id) on delete set null,
  room_id    uuid not null references rooms(id) on delete cascade,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles      enable row level security;
alter table rooms         enable row level security;
alter table room_members  enable row level security;
alter table foods         enable row level security;

-- ── profiles policies ────────────────────────────────────────
drop policy if exists "profiles: user can read all" on profiles;
create policy "profiles: user can read all"
  on profiles for select to authenticated
  using (true);

drop policy if exists "profiles: user can upsert own" on profiles;
create policy "profiles: user can upsert own"
  on profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles: user can update own" on profiles;
create policy "profiles: user can update own"
  on profiles for update to authenticated
  using (id = auth.uid());

-- ── rooms policies ────────────────────────────────────────────
drop policy if exists "rooms: anyone can create" on rooms;
create policy "rooms: anyone can create"
  on rooms for insert to authenticated
  with check (true);

drop policy if exists "rooms: authenticated can read" on rooms;
create policy "rooms: authenticated can read"
  on rooms for select to authenticated
  using (true);

drop policy if exists "rooms: members can update title" on rooms;
create policy "rooms: members can update title"
  on rooms for update to authenticated
  using (
    exists (
      select 1 from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = rooms.id
    )
  );

-- ── room_members policies ────────────────────────────────────
drop policy if exists "room_members: user can join" on room_members;
create policy "room_members: user can join"
  on room_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "room_members: authenticated can read" on room_members;
create policy "room_members: authenticated can read"
  on room_members for select to authenticated
  using (true);

drop policy if exists "room_members: user can leave" on room_members;
create policy "room_members: user can leave"
  on room_members for delete to authenticated
  using (user_id = auth.uid());

-- ── foods policies ────────────────────────────────────────────
drop policy if exists "foods: members can read" on foods;
create policy "foods: members can read"
  on foods for select to authenticated
  using (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = foods.room_id
    )
  );

drop policy if exists "foods: members can insert" on foods;
create policy "foods: members can insert"
  on foods for insert to authenticated
  with check (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = foods.room_id
    )
  );

drop policy if exists "foods: members can delete" on foods;
create policy "foods: members can delete"
  on foods for delete to authenticated
  using (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = foods.room_id
    )
  );

-- ============================================================
-- Storage (for profile pictures)
-- ============================================================
-- Run in Supabase Dashboard → Storage:
-- 1. Create a bucket named "avatars" with public access
-- 2. Or run:
--    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- Allow authenticated users to upload their own avatar
-- insert into storage.policies ... (configure via Dashboard)

-- ============================================================
-- Realtime
-- ============================================================
-- Enable Realtime for both tables via Dashboard:
-- Database → Replication → select "foods" and "rooms"
-- Or:
-- alter publication supabase_realtime add table foods;
-- alter publication supabase_realtime add table rooms;

-- ============================================================
-- Indexes (performance)
-- ============================================================
create index if not exists idx_room_members_user_id on room_members(user_id);
create index if not exists idx_room_members_room_id on room_members(room_id);
create index if not exists idx_foods_room_id        on foods(room_id);
create index if not exists idx_rooms_invite_code    on rooms(invite_code);
