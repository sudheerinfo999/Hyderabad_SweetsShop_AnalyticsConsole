# Supabase Setup

This folder contains everything you need to provision the Supabase project that
powers the Hyderabad Sweets analytics platform.

## 1. Apply the schema

In the Supabase dashboard SQL editor (or `psql`), run the files in order:

```bash
psql "$SUPABASE_CONNECTION_STRING" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_CONNECTION_STRING" -f supabase/migrations/0002_favourite_sweet.sql
psql "$SUPABASE_CONNECTION_STRING" -f supabase/migrations/0003_customer_review.sql
psql "$SUPABASE_CONNECTION_STRING" -f supabase/migrations/0004_customer_visits.sql
psql "$SUPABASE_CONNECTION_STRING" -f supabase/migrations/0005_performance.sql
psql "$SUPABASE_CONNECTION_STRING" -f supabase/seed.sql
```

Or, if you use the Supabase CLI:

```bash
supabase db reset --linked   # destructive
supabase db push             # safer incremental approach
```

The migration is idempotent — running it twice will not duplicate rows.

`0004_customer_visits.sql` adds `visit_count` on `customers`, a `customer_visits`
ledger (for daily revenue on return visits), and allows staff to update customer
rows when recording a returning visit.

`0005_performance.sql` adds trigram search indexes, a visit lookup index, and the
`search_customers_counter()` RPC used by the Add Customer predictive search (one
DB round-trip instead of multiple queries).

## 2. Create your first admin user

Supabase Auth signs the user up, then a trigger creates a row in `profiles`
with the role `staff`. Promote yourself to admin in SQL:

```sql
update public.profiles
   set role = 'admin', is_active = true
 where email = 'you@hyderabadsweets.local';
```

You can also override the role at signup by passing `raw_user_meta_data` when
inviting users via the dashboard:

```json
{ "full_name": "Anil Kumar", "role": "admin" }
```

## 3. Environment variables

Add these to `.env.local` (or in your Vercel project settings):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # only used by trusted server code
```

## 4. Row-level security

All tables are RLS-enabled. Policies:

- `profiles`: users can read their own row; admins can read & manage all.
- `hyderabad_areas`, `hyderabad_sub_areas`, `shop_branches`: readable by every
  authenticated user; writable by admins only.
- `customers`: any signed-in staff member can read, insert, and update (needed
  for visit increments); admins can also delete.
- `customer_visits`: staff can read & insert; admins can delete.

The `assign_nearest_branch` trigger automatically fills in `nearest_branch_id`
and `distance_km` whenever a customer is inserted or moved, using the area /
sub-area centroid as a fallback when no exact lat/lng is provided.
