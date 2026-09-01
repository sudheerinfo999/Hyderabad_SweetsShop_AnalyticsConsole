-- Visit tracking + staff updates for returning customers.
-- visit_count lives on customers; each counter save also writes customer_visits
-- so daily revenue can attribute amounts to the day of the visit.

alter table public.customers
  add column if not exists visit_count integer not null default 1
    check (visit_count >= 1);

create table if not exists public.customer_visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  purchase_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists customer_visits_customer_idx
  on public.customer_visits (customer_id);

create index if not exists customer_visits_created_at_idx
  on public.customer_visits (created_at desc);

-- Backfill one visit per existing customer (uses original created_at / amount).
insert into public.customer_visits (customer_id, purchase_amount, created_at, created_by)
select c.id, c.purchase_amount, c.created_at, c.created_by
from public.customers c
where not exists (
  select 1 from public.customer_visits v where v.customer_id = c.id
);

-- Staff need to update visit_count / cumulative amount on returning customers.
drop policy if exists "customers_update_admin" on public.customers;
drop policy if exists "customers_update_staff" on public.customers;
create policy "customers_update_staff"
  on public.customers
  for update
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

alter table public.customer_visits enable row level security;

drop policy if exists "customer_visits_read" on public.customer_visits;
create policy "customer_visits_read" on public.customer_visits
  for select using (public.is_staff_or_admin());

drop policy if exists "customer_visits_insert" on public.customer_visits;
create policy "customer_visits_insert" on public.customer_visits
  for insert with check (public.is_staff_or_admin());

drop policy if exists "customer_visits_delete_admin" on public.customer_visits;
create policy "customer_visits_delete_admin" on public.customer_visits
  for delete using (public.is_admin());
