-- Favourite sweet selected at the counter (free 2-piece promo).
alter table public.customers
  add column if not exists favourite_sweet text;

create index if not exists customers_favourite_sweet_idx
  on public.customers (favourite_sweet);
