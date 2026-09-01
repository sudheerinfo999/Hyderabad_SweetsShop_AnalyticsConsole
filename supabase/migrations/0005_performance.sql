-- Performance: search indexes + single-query counter search RPC.

create extension if not exists pg_trgm;

create index if not exists customers_name_trgm_idx
  on public.customers using gin (customer_name gin_trgm_ops);

create index if not exists customer_visits_customer_created_idx
  on public.customer_visits (customer_id, created_at desc);

-- One round-trip search for the Add Customer predictive dropdown.
create or replace function public.search_customers_counter(
  p_name text default null,
  p_mobile_digits text default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  customer_name text,
  mobile_number text,
  main_area text,
  sub_area text,
  favourite_sweet text,
  review text,
  visit_count integer,
  purchase_amount numeric,
  created_at timestamptz,
  last_visited_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with matched as (
    select c.*
    from public.customers c
    where (
      coalesce(length(trim(p_name)), 0) >= 2
      and c.customer_name ilike '%' || trim(p_name) || '%'
    )
    or (
      coalesce(length(p_mobile_digits), 0) >= 6
      and c.mobile_number is not null
      and regexp_replace(c.mobile_number, '\D', '', 'g') like '%' || p_mobile_digits || '%'
    )
    order by
      case
        when coalesce(length(trim(p_name)), 0) >= 2
          and c.customer_name ilike trim(p_name) || '%' then 0
        else 1
      end,
      c.customer_name asc,
      c.created_at desc
    limit greatest(1, least(coalesce(p_limit, 8), 20))
  )
  select
    m.id,
    m.customer_name,
    m.mobile_number,
    m.main_area,
    m.sub_area,
    m.favourite_sweet,
    m.review,
    m.visit_count,
    m.purchase_amount,
    m.created_at,
    coalesce(lv.created_at, m.created_at) as last_visited_at
  from matched m
  left join lateral (
    select v.created_at
    from public.customer_visits v
    where v.customer_id = m.id
    order by v.created_at desc
    limit 1
  ) lv on true;
$$;

grant execute on function public.search_customers_counter(text, text, integer) to authenticated;
