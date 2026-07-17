-- Hyderabad Sweets — Customer Analytics & Branch Expansion
-- Initial schema, helper functions, RLS policies.
-- Idempotent where reasonable.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Profiles (linked to auth.users) with role-based access
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'staff');
  end if;
end$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role public.app_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Master data: Hyderabad areas & sub-areas
-- ---------------------------------------------------------------------------
create table if not exists public.hyderabad_areas (
  id uuid primary key default gen_random_uuid(),
  area_name text not null unique,
  zone_name text not null,
  latitude numeric(10, 6) not null,
  longitude numeric(10, 6) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hyderabad_sub_areas (
  id uuid primary key default gen_random_uuid(),
  main_area_id uuid not null references public.hyderabad_areas(id) on delete cascade,
  sub_area_name text not null,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (main_area_id, sub_area_name)
);

create index if not exists sub_areas_main_idx on public.hyderabad_sub_areas (main_area_id);

-- ---------------------------------------------------------------------------
-- 3. Shop branches
-- ---------------------------------------------------------------------------
create table if not exists public.shop_branches (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null unique,
  address text not null,
  main_area text not null,
  latitude numeric(10, 6) not null,
  longitude numeric(10, 6) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  mobile_number text,
  main_area text not null,
  sub_area text,
  full_address text,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  place_id text,
  purchase_amount numeric(12, 2),
  favourite_sweet text,
  nearest_branch_id uuid references public.shop_branches(id) on delete set null,
  distance_km numeric(8, 3),
  is_estimated_location boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists customers_main_area_idx on public.customers (main_area);
create index if not exists customers_sub_area_idx on public.customers (sub_area);
create index if not exists customers_created_at_idx on public.customers (created_at desc);
create index if not exists customers_branch_idx on public.customers (nearest_branch_id);
create index if not exists customers_mobile_idx on public.customers (mobile_number);

-- ---------------------------------------------------------------------------
-- 5. Helper SQL: Haversine distance (km) for nearest-branch calculation
-- ---------------------------------------------------------------------------
create or replace function public.haversine_km(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) returns numeric
language plpgsql
immutable
as $$
declare
  r constant numeric := 6371; -- Earth's mean radius in km
  d_lat numeric;
  d_lon numeric;
  a numeric;
  c numeric;
begin
  if lat1 is null or lon1 is null or lat2 is null or lon2 is null then
    return null;
  end if;
  d_lat := radians(lat2 - lat1);
  d_lon := radians(lon2 - lon1);
  a := sin(d_lat / 2) ^ 2
       + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ^ 2;
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  return round((r * c)::numeric, 3);
end;
$$;

-- Trigger to auto-assign nearest branch + distance when customer row is touched.
create or replace function public.assign_nearest_branch()
returns trigger
language plpgsql
as $$
declare
  v_lat numeric := new.latitude;
  v_lon numeric := new.longitude;
  v_best_id uuid;
  v_best_distance numeric;
  v_area_lat numeric;
  v_area_lon numeric;
begin
  -- Fall back to area / sub-area centroid if customer has no exact lat/lng.
  if v_lat is null or v_lon is null then
    select coalesce(sa.latitude, a.latitude), coalesce(sa.longitude, a.longitude)
      into v_lat, v_lon
    from public.hyderabad_areas a
    left join public.hyderabad_sub_areas sa
      on sa.main_area_id = a.id
     and sa.sub_area_name = new.sub_area
    where a.area_name = new.main_area
    limit 1;

    new.latitude := v_lat;
    new.longitude := v_lon;
    new.is_estimated_location := true;
  end if;

  if v_lat is null or v_lon is null then
    return new;
  end if;

  select b.id, public.haversine_km(v_lat, v_lon, b.latitude, b.longitude) as d
    into v_best_id, v_best_distance
  from public.shop_branches b
  where b.is_active = true
  order by public.haversine_km(v_lat, v_lon, b.latitude, b.longitude) asc
  limit 1;

  new.nearest_branch_id := v_best_id;
  new.distance_km := v_best_distance;
  return new;
end;
$$;

drop trigger if exists trg_assign_nearest_branch on public.customers;
create trigger trg_assign_nearest_branch
  before insert or update of latitude, longitude, main_area, sub_area on public.customers
  for each row execute procedure public.assign_nearest_branch();

-- ---------------------------------------------------------------------------
-- 6. RLS policies — internal-only application
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.hyderabad_areas enable row level security;
alter table public.hyderabad_sub_areas enable row level security;
alter table public.shop_branches enable row level security;
alter table public.customers enable row level security;

-- helper for role checks
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
  );
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  );
$$;

-- profiles
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- master data: readable by any authenticated user, writable by admins only.
drop policy if exists "areas_read" on public.hyderabad_areas;
create policy "areas_read" on public.hyderabad_areas
  for select using (public.is_staff_or_admin());

drop policy if exists "areas_admin_write" on public.hyderabad_areas;
create policy "areas_admin_write" on public.hyderabad_areas
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sub_areas_read" on public.hyderabad_sub_areas;
create policy "sub_areas_read" on public.hyderabad_sub_areas
  for select using (public.is_staff_or_admin());

drop policy if exists "sub_areas_admin_write" on public.hyderabad_sub_areas;
create policy "sub_areas_admin_write" on public.hyderabad_sub_areas
  for all using (public.is_admin()) with check (public.is_admin());

-- branches: readable by all signed-in users, writable by admins
drop policy if exists "branches_read" on public.shop_branches;
create policy "branches_read" on public.shop_branches
  for select using (public.is_staff_or_admin());

drop policy if exists "branches_admin_write" on public.shop_branches;
create policy "branches_admin_write" on public.shop_branches
  for all using (public.is_admin()) with check (public.is_admin());

-- customers: staff can read & insert; admins can do anything.
drop policy if exists "customers_read" on public.customers;
create policy "customers_read" on public.customers
  for select using (public.is_staff_or_admin());

drop policy if exists "customers_insert" on public.customers;
create policy "customers_insert" on public.customers
  for insert with check (public.is_staff_or_admin());

drop policy if exists "customers_update_admin" on public.customers;
create policy "customers_update_admin" on public.customers
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customers_delete_admin" on public.customers;
create policy "customers_delete_admin" on public.customers
  for delete using (public.is_admin());
