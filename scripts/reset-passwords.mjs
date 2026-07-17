// Reset passwords for the two seed users using the Supabase Admin API.
// Usage: node scripts/reset-passwords.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Load .env.local manually (no dotenv dependency needed).
const envPath = path.join(projectRoot, ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORDS = [
  { email: "admin@victoryfoodproducts.com", password: "Admin@12345" },
  { email: "victoryfoodproducts111@gmail.com", password: "Counter@12345" },
];

async function findUserId(email) {
  // listUsers is paginated; we'll iterate until we find it (we only have ~2 users).
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) return match.id;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

async function main() {
  for (const { email, password } of PASSWORDS) {
    const id = await findUserId(email);
    if (!id) {
      console.error(`  ✗ ${email} → user not found`);
      continue;
    }
    const { error } = await admin.auth.admin.updateUserById(id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error(`  ✗ ${email} → ${error.message}`);
    } else {
      console.log(`  ✓ ${email} → password set to "${password}"`);
    }
  }
}

main().catch((err) => {
  console.error("✗ failed:", err.message);
  process.exit(1);
});
