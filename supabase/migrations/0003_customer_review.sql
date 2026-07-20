-- Customer feedback / review captured at the counter.
alter table public.customers
  add column if not exists review text;
