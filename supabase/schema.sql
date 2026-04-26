-- ============================================================
-- Couple Food — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

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
  place_name text,
  location   text,
  map_url    text,
  latitude   double precision,
  longitude  double precision,
  person     text check (person in ('여친', '남친', '둘다')),
  category   text,
  notes      text,
  price_level int check (price_level between 1 and 4),
  is_favorite boolean not null default false,
  eaten_at   timestamptz,
  added_by   uuid references auth.users(id) on delete set null,
  room_id    uuid not null references rooms(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists memories (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  food_id    uuid not null references foods(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  photo_url  text,
  note       text,
  visited_at timestamptz not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles      enable row level security;
alter table rooms         enable row level security;
alter table room_members  enable row level security;
alter table foods         enable row level security;
alter table memories      enable row level security;

-- ============================================================
-- Couple Safety Functions
-- ============================================================

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;

  return result;
end;
$$;

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = target_room_id
      and rm.user_id = auth.uid()
  );
$$;

create or replace function public.enforce_couple_membership_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.room_members
    where user_id = new.user_id
  ) then
    raise exception 'already_connected';
  end if;

  if (
    select count(*)
    from public.room_members
    where room_id = new.room_id
  ) >= 2 then
    raise exception 'couple_full';
  end if;

  return new;
end;
$$;

drop trigger if exists room_members_limit_couple_size on public.room_members;
create trigger room_members_limit_couple_size
  before insert on public.room_members
  for each row execute function public.enforce_couple_membership_limits();

create or replace function public.create_couple(room_title text default '우리의 맛집 리스트')
returns table (
  id uuid,
  title text,
  invite_code text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  room_record public.rooms%rowtype;
  attempt int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1 from public.room_members rm
    where rm.user_id = auth.uid()
  ) then
    raise exception 'already_connected';
  end if;

  for attempt in 1..8 loop
    code := public.generate_invite_code();

    begin
      insert into public.rooms (title, invite_code)
      values (coalesce(nullif(btrim(room_title), ''), '우리의 맛집 리스트'), code)
      returning * into room_record;
      exit;
    exception when unique_violation then
      room_record := null;
    end;
  end loop;

  if room_record.id is null then
    raise exception 'invite_code_generation_failed';
  end if;

  insert into public.room_members (room_id, user_id)
  values (room_record.id, auth.uid());

  return query
    select room_record.id, room_record.title, room_record.invite_code, room_record.created_at;
end;
$$;

create or replace function public.join_couple_by_invite_code(invite_code_input text)
returns table (
  id uuid,
  title text,
  invite_code text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_code text := upper(btrim(invite_code_input));
  room_record public.rooms%rowtype;
  current_member_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into room_record
  from public.rooms r
  where r.invite_code = cleaned_code
  for update;

  if room_record.id is null then
    raise exception 'invalid_invite_code';
  end if;

  if exists (
    select 1 from public.room_members rm
    where rm.user_id = auth.uid()
      and rm.room_id = room_record.id
  ) then
    return query
      select room_record.id, room_record.title, room_record.invite_code, room_record.created_at;
    return;
  end if;

  if exists (
    select 1 from public.room_members rm
    where rm.user_id = auth.uid()
  ) then
    raise exception 'already_connected';
  end if;

  select count(*) into current_member_count
  from public.room_members rm
  where rm.room_id = room_record.id;

  if current_member_count >= 2 then
    raise exception 'couple_full';
  end if;

  insert into public.room_members (room_id, user_id)
  values (room_record.id, auth.uid());

  return query
    select room_record.id, room_record.title, room_record.invite_code, room_record.created_at;
end;
$$;

drop function if exists public.get_my_couple();
create or replace function public.get_my_couple()
returns table (
  id uuid,
  title text,
  invite_code text,
  created_at timestamptz,
  member_count int,
  partner_id uuid,
  partner_nickname text,
  partner_avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.title, r.invite_code, r.created_at,
    (
      select count(*)::int
      from public.room_members rm_count
      where rm_count.room_id = r.id
    ) as member_count,
    rm_partner.user_id as partner_id,
    p.nickname as partner_nickname,
    p.avatar_url as partner_avatar_url
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  left join public.room_members rm_partner
    on rm_partner.room_id = r.id
    and rm_partner.user_id <> auth.uid()
  left join public.profiles p on p.id = rm_partner.user_id
  where rm.user_id = auth.uid()
  order by rm.created_at desc
  limit 1;
$$;

grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple_by_invite_code(text) to authenticated;
grant execute on function public.get_my_couple() to authenticated;

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

drop policy if exists "rooms: authenticated can read" on rooms;
drop policy if exists "rooms: members can read" on rooms;
create policy "rooms: members can read"
  on rooms for select to authenticated
  using (public.is_room_member(id));

drop policy if exists "rooms: members can update title" on rooms;
create policy "rooms: members can update title"
  on rooms for update to authenticated
  using (public.is_room_member(id));

-- ── room_members policies ────────────────────────────────────
drop policy if exists "room_members: user can join" on room_members;

drop policy if exists "room_members: authenticated can read" on room_members;
drop policy if exists "room_members: user can read own" on room_members;
create policy "room_members: user can read own"
  on room_members for select to authenticated
  using (user_id = auth.uid());

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

drop policy if exists "foods: members can update" on foods;
create policy "foods: members can update"
  on foods for update to authenticated
  using (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = foods.room_id
    )
  )
  with check (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = foods.room_id
    )
  );

-- ── memories policies ─────────────────────────────────────────
drop policy if exists "memories: members can read" on memories;
create policy "memories: members can read"
  on memories for select to authenticated
  using (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = memories.room_id
    )
  );

drop policy if exists "memories: members can insert" on memories;
create policy "memories: members can insert"
  on memories for insert to authenticated
  with check (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = memories.room_id
    )
  );

drop policy if exists "memories: members can update" on memories;
create policy "memories: members can update"
  on memories for update to authenticated
  using (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = memories.room_id
    )
  )
  with check (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = memories.room_id
    )
  );

drop policy if exists "memories: members can delete" on memories;
create policy "memories: members can delete"
  on memories for delete to authenticated
  using (
    exists (
      select 1
      from room_members rm
      where rm.user_id = auth.uid()
        and rm.room_id = memories.room_id
    )
  );

-- ============================================================
-- Storage (for profile pictures)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('memory-photos', 'memory-photos', true)
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars: authenticated upload own" on storage.objects;
create policy "avatars: authenticated upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars: authenticated update own" on storage.objects;
create policy "avatars: authenticated update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars: authenticated delete own" on storage.objects;
create policy "avatars: authenticated delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "memory-photos: public read" on storage.objects;
create policy "memory-photos: public read"
  on storage.objects for select to public
  using (bucket_id = 'memory-photos');

drop policy if exists "memory-photos: authenticated upload own room memory" on storage.objects;
create policy "memory-photos: authenticated upload own room memory"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memory-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "memory-photos: authenticated update own room memory" on storage.objects;
create policy "memory-photos: authenticated update own room memory"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'memory-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
  )
  with check (
    bucket_id = 'memory-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "memory-photos: authenticated delete own room memory" on storage.objects;
create policy "memory-photos: authenticated delete own room memory"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'memory-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

-- ============================================================
-- Realtime
-- ============================================================
-- Enable Realtime for both tables via Dashboard:
-- Database → Replication → select "foods", "rooms", "room_members", and "memories"
-- Or:
-- alter publication supabase_realtime add table foods;
-- alter publication supabase_realtime add table rooms;
-- alter publication supabase_realtime add table room_members;
-- alter publication supabase_realtime add table memories;

-- ============================================================
-- Indexes (performance)
-- ============================================================
create index if not exists idx_room_members_user_id on room_members(user_id);
create index if not exists idx_room_members_room_id on room_members(room_id);
create index if not exists idx_foods_room_id        on foods(room_id);
create index if not exists idx_foods_eaten_at       on foods(eaten_at);
create index if not exists idx_foods_category       on foods(category);
create index if not exists idx_foods_latitude       on foods(latitude);
create index if not exists idx_foods_longitude      on foods(longitude);
create index if not exists idx_memories_room_id     on memories(room_id);
create index if not exists idx_memories_food_id     on memories(food_id);
create index if not exists idx_memories_visited_at  on memories(visited_at);
create index if not exists idx_rooms_invite_code    on rooms(invite_code);
