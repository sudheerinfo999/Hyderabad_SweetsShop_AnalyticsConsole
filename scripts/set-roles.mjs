// Verify auth users exist and assign roles in public.profiles.
// Usage: PGPASSWORD=... node scripts/set-roles.mjs
import pg from "pg";

const ADMIN_EMAIL = "admin@victoryfoodproducts.com";
const STAFF_EMAIL = "victoryfoodproducts111@gmail.com";

const host = process.env.PGHOST || "db.jcyhsxbrwxvrszahowst.supabase.co";
const port = Number(process.env.PGPORT || 5432);
const user = process.env.PGUSER || "postgres";
const database = process.env.PGDATABASE || "postgres";
const password = process.env.PGPASSWORD;

if (!password) {
  console.error("PGPASSWORD env var is required");
  process.exit(1);
}

const client = new pg.Client({
  host,
  port,
  user,
  database,
  password,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log(`✓ connected to ${host}\n`);

  console.log("— checking auth.users —");
  const usersRes = await client.query(
    `select id, email, email_confirmed_at, created_at
       from auth.users
      where email = any($1::text[])`,
    [[ADMIN_EMAIL, STAFF_EMAIL]],
  );

  const byEmail = new Map(usersRes.rows.map((r) => [r.email, r]));
  for (const email of [ADMIN_EMAIL, STAFF_EMAIL]) {
    const u = byEmail.get(email);
    if (!u) {
      console.log(`  ✗ ${email} → NOT FOUND in auth.users`);
    } else {
      const confirmed = u.email_confirmed_at ? "confirmed" : "NOT CONFIRMED";
      console.log(`  ✓ ${email} → ${u.id} (${confirmed})`);
    }
  }

  const missing = [ADMIN_EMAIL, STAFF_EMAIL].filter((e) => !byEmail.has(e));
  if (missing.length) {
    console.error(`\n✗ The following users were not found in auth.users:`);
    for (const m of missing) console.error(`   - ${m}`);
    console.error(`\nCreate them in Supabase Dashboard → Authentication → Users → "Add user".`);
    console.error(`Be sure to toggle ON "Auto Confirm User".`);
    await client.end();
    process.exit(1);
  }

  console.log("\n— ensuring profile rows exist —");
  // Profile rows are auto-created by trigger, but for users that existed BEFORE
  // the trigger was installed we backfill manually here (idempotent).
  await client.query(
    `insert into public.profiles (id, email, full_name, role, is_active)
       select u.id,
              u.email,
              coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
              'staff',
              true
         from auth.users u
        where u.email = any($1::text[])
     on conflict (id) do nothing`,
    [[ADMIN_EMAIL, STAFF_EMAIL]],
  );

  console.log("\n— assigning roles —");
  const adminRes = await client.query(
    `update public.profiles
        set role = 'admin', is_active = true, updated_at = now()
      where email = $1
      returning email, role, is_active`,
    [ADMIN_EMAIL],
  );
  for (const row of adminRes.rows) {
    console.log(`  ✓ ${row.email} → role=${row.role}, active=${row.is_active}`);
  }

  const staffRes = await client.query(
    `update public.profiles
        set role = 'staff', is_active = true, updated_at = now()
      where email = $1
      returning email, role, is_active`,
    [STAFF_EMAIL],
  );
  for (const row of staffRes.rows) {
    console.log(`  ✓ ${row.email} → role=${row.role}, active=${row.is_active}`);
  }

  console.log("\n— final profiles table —");
  const finalRes = await client.query(
    `select email, role, is_active, created_at
       from public.profiles
      where email = any($1::text[])
      order by role desc, email`,
    [[ADMIN_EMAIL, STAFF_EMAIL]],
  );
  console.table(
    finalRes.rows.map((r) => ({
      email: r.email,
      role: r.role,
      active: r.is_active,
    })),
  );

  await client.end();
  console.log("\n✓ done");
}

main().catch(async (err) => {
  console.error("✗ failed:", err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
