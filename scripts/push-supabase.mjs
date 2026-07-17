// One-off bootstrap: push schema + seed to a Supabase project.
// Usage: PGPASSWORD=... node scripts/push-supabase.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const host = process.env.PGHOST || "db.jcyhsxbrwxvrszahowst.supabase.co";
const port = Number(process.env.PGPORT || 5432);
const user = process.env.PGUSER || "postgres";
const database = process.env.PGDATABASE || "postgres";
const password = process.env.PGPASSWORD;

if (!password) {
  console.error("PGPASSWORD env var is required");
  process.exit(1);
}

const files = [
  "supabase/migrations/0001_init.sql",
  "supabase/seed.sql",
];

const client = new pg.Client({
  host,
  port,
  user,
  database,
  password,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log(`→ connecting to ${user}@${host}:${port}/${database}`);
  await client.connect();
  console.log("✓ connected");

  for (const relPath of files) {
    const fullPath = path.join(projectRoot, relPath);
    const sql = fs.readFileSync(fullPath, "utf8");
    console.log(`→ executing ${relPath} (${sql.length.toLocaleString()} chars)`);
    await client.query(sql);
    console.log(`✓ ${relPath} applied`);
  }

  console.log("\n— verification —");
  const checks = [
    ["areas (master)", "select count(*) from public.hyderabad_areas"],
    ["sub-areas (master)", "select count(*) from public.hyderabad_sub_areas"],
    ["branches", "select count(*) from public.shop_branches"],
    ["customers", "select count(*) from public.customers"],
    ["profiles", "select count(*) from public.profiles"],
  ];
  for (const [label, query] of checks) {
    const r = await client.query(query);
    console.log(`  ${label.padEnd(20)} : ${r.rows[0].count}`);
  }

  await client.end();
  console.log("\n✓ done");
}

run().catch(async (err) => {
  console.error("✗ failed:", err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
