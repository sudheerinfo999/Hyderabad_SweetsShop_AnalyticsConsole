// Pull live data from Supabase and explain — step-by-step — how the
// recommendation engine arrived at each candidate. Pure diagnostic.
//
// Usage: PGPASSWORD=... node scripts/explain-recommendations.mjs
import pg from "pg";

const host = process.env.PGHOST || "db.jcyhsxbrwxvrszahowst.supabase.co";
const password = process.env.PGPASSWORD;
if (!password) {
  console.error("PGPASSWORD env var is required");
  process.exit(1);
}

const client = new pg.Client({
  host,
  port: 5432,
  user: "postgres",
  database: "postgres",
  password,
  ssl: { rejectUnauthorized: false },
});

// ---- Same constants as src/lib/analytics/recommendations.ts ----
const WEIGHTS = { demand: 0.4, growth: 0.18, distance: 0.16, coverage: 0.18, repeat: 0.08 };
const MIN_CANDIDATE_CUSTOMERS = 2;

function haversine(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalise(value, max) {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

async function main() {
  await client.connect();
  console.log(`✓ connected to ${host}\n`);

  const [areasRes, branchesRes, customersRes] = await Promise.all([
    client.query(`select id, area_name, zone_name, latitude, longitude, is_active
                    from public.hyderabad_areas where is_active = true`),
    client.query(`select id, branch_name, main_area, latitude, longitude, is_active
                    from public.shop_branches where is_active = true`),
    client.query(`select id, customer_name, mobile_number, main_area, sub_area,
                         latitude, longitude, nearest_branch_id, distance_km,
                         purchase_amount, created_at
                    from public.customers order by created_at asc`),
  ]);
  const areas = areasRes.rows;
  const branches = branchesRes.rows;
  const customers = customersRes.rows;

  console.log("============ INPUT DATA ============");
  console.log(`branches    : ${branches.length}`);
  branches.forEach((b) => {
    console.log(`  - ${b.branch_name.padEnd(40)} @ (${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)})`);
  });
  console.log(`master areas: ${areas.length}`);
  console.log(`customers   : ${customers.length}\n`);

  console.log("============ CUSTOMER DUMP (all rows) ============");
  const fmtDate = (d) => new Date(d).toISOString().slice(0, 19).replace("T", " ");
  for (const c of customers) {
    const branchName =
      branches.find((b) => b.id === c.nearest_branch_id)?.branch_name ?? "—";
    console.log(
      `  ${c.customer_name.padEnd(20)} | ${c.main_area.padEnd(22)} | ${(c.sub_area ?? "—").padEnd(22)} | ` +
        `${(c.distance_km == null ? "—" : Number(c.distance_km).toFixed(2)).padStart(7)} km | ` +
        `nearest: ${branchName.padEnd(35)} | ${fmtDate(c.created_at)}`,
    );
  }
  console.log("");

  // -------- Per-area aggregation --------
  const now = Date.now();
  const THIRTY = 30 * 24 * 3600 * 1000;
  const branchAreasLower = new Set(branches.map((b) => b.main_area.toLowerCase()));

  const stats = new Map();
  for (const a of areas) {
    stats.set(a.area_name, {
      area: a,
      customers: [],
      last30: [],
      prev30: [],
      mobiles: new Set(),
      repeatMobiles: new Set(),
      subAreaCounts: new Map(),
    });
  }
  for (const c of customers) {
    const s = stats.get(c.main_area);
    if (!s) continue;
    s.customers.push(c);
    const t = new Date(c.created_at).getTime();
    if (now - t <= THIRTY) s.last30.push(c);
    else if (now - t <= 2 * THIRTY) s.prev30.push(c);
    if (c.mobile_number) {
      if (s.mobiles.has(c.mobile_number)) s.repeatMobiles.add(c.mobile_number);
      else s.mobiles.add(c.mobile_number);
    }
    if (c.sub_area) {
      s.subAreaCounts.set(c.sub_area, (s.subAreaCounts.get(c.sub_area) ?? 0) + 1);
    }
  }

  // -------- Candidate set (exclude areas that already have an active branch) --------
  const candidates = [];
  for (const s of stats.values()) {
    if (branchAreasLower.has(s.area.area_name.toLowerCase())) continue;
    if (s.customers.length < MIN_CANDIDATE_CUSTOMERS) continue;

    const c30 = s.last30.length;
    const cPrev = s.prev30.length;
    const growthPct =
      c30 === 0 && cPrev === 0 ? null : cPrev === 0 ? 100 : ((c30 - cPrev) / cPrev) * 100;

    let distSum = 0, distCount = 0;
    for (const c of s.customers) {
      if (c.distance_km != null) { distSum += Number(c.distance_km); distCount += 1; }
    }
    const avgTravelKm = distCount > 0 ? distSum / distCount : null;

    let nearestBranchKm = null;
    if (branches.length > 0) {
      nearestBranchKm = Infinity;
      for (const b of branches) {
        const d = haversine(
          { lat: Number(s.area.latitude), lng: Number(s.area.longitude) },
          { lat: Number(b.latitude), lng: Number(b.longitude) },
        );
        if (d < nearestBranchKm) nearestBranchKm = d;
      }
      if (!Number.isFinite(nearestBranchKm)) nearestBranchKm = null;
    }

    const uniqueCount = s.mobiles.size;
    const repeatRate = uniqueCount > 0 ? s.repeatMobiles.size / uniqueCount : 0;

    let topSubArea = null, topSubCount = 0;
    for (const [name, count] of s.subAreaCounts) {
      if (count > topSubCount) { topSubCount = count; topSubArea = name; }
    }

    candidates.push({
      area: s.area.area_name,
      zone: s.area.zone_name,
      customers: s.customers.length,
      last30: c30,
      prev30: cPrev,
      growthPct,
      avgTravelKm,
      nearestBranchKm,
      repeatRate,
      topSubArea,
    });
  }

  // -------- Normalisation maxima (used to scale 0-100) --------
  const maxCustomers = Math.max(1, ...candidates.map((r) => r.customers));
  const maxGrowth    = Math.max(1, ...candidates.map((r) => r.growthPct ?? 0));
  const maxAvgTravel = Math.max(1, ...candidates.map((r) => r.avgTravelKm ?? 0));
  const maxNearest   = Math.max(1, ...candidates.map((r) => r.nearestBranchKm ?? 0));

  console.log("============ NORMALISATION MAXIMA ============");
  console.log(`  max customers     : ${maxCustomers}`);
  console.log(`  max growth %      : ${maxGrowth.toFixed(2)}`);
  console.log(`  max avg-travel km : ${maxAvgTravel.toFixed(2)}`);
  console.log(`  max nearest km    : ${maxNearest.toFixed(2)}\n`);

  // -------- Score every candidate --------
  const scored = candidates.map((r) => {
    const demandScore   = normalise(r.customers, maxCustomers);
    const growthScore   = normalise(Math.max(0, r.growthPct ?? 0), maxGrowth);
    const distanceScore = normalise(r.avgTravelKm ?? 0, maxAvgTravel);
    const coverageScore = normalise(r.nearestBranchKm ?? 0, maxNearest);
    const repeatScore   = Math.min(100, r.repeatRate * 200);
    const confidence =
      demandScore   * WEIGHTS.demand   +
      growthScore   * WEIGHTS.growth   +
      distanceScore * WEIGHTS.distance +
      coverageScore * WEIGHTS.coverage +
      repeatScore   * WEIGHTS.repeat;
    return { ...r, demandScore, growthScore, distanceScore, coverageScore, repeatScore, confidence };
  });

  scored.sort((a, b) => b.confidence - a.confidence);

  console.log("============ SCORE TABLE (sorted by confidence) ============");
  console.log(
    "  rank  area               cust  30d/prev  grow%   avgKm   nearKm  | dem  grow  dist  cov   rep  | TOTAL",
  );
  const fmt = (v, w = 5) => (v == null ? "—".padStart(w) : Number(v).toFixed(1).padStart(w));
  scored.forEach((r, idx) => {
    const mark = idx < 3 ? "★" : " ";
    console.log(
      ` ${mark}#${(idx + 1).toString().padStart(2)}  ` +
        `${r.area.padEnd(18)} ${r.customers.toString().padStart(4)}` +
        ` ${r.last30}/${r.prev30}`.padStart(8) +
        ` ${fmt(r.growthPct, 6)}` +
        ` ${fmt(r.avgTravelKm, 7)}` +
        ` ${fmt(r.nearestBranchKm, 7)}  |` +
        ` ${fmt(r.demandScore)} ${fmt(r.growthScore)} ${fmt(r.distanceScore)} ${fmt(r.coverageScore)} ${fmt(r.repeatScore)}  |` +
        ` ${r.confidence.toFixed(1)}`,
    );
  });

  // -------- Highlight the top 3 with explicit math --------
  console.log("\n============ TOP 3 — STEP-BY-STEP CALCULATION ============");
  for (let i = 0; i < Math.min(3, scored.length); i++) {
    const r = scored[i];
    console.log(`\n#${i + 1}  ${r.area}  (zone: ${r.zone})`);
    console.log(`  inputs:`);
    console.log(`    total customers ............ ${r.customers}`);
    console.log(`    last 30d / prev 30d ........ ${r.last30} / ${r.prev30}`);
    console.log(`    growth % ................... ${r.growthPct == null ? "n/a" : r.growthPct.toFixed(2) + "%"}`);
    console.log(`    avg travel today (km) ...... ${r.avgTravelKm == null ? "n/a" : r.avgTravelKm.toFixed(2)}`);
    console.log(`    nearest branch (km) ........ ${r.nearestBranchKm == null ? "n/a" : r.nearestBranchKm.toFixed(2)}`);
    console.log(`    repeat-customer rate ....... ${(r.repeatRate * 100).toFixed(0)}%`);
    console.log(`    top sub-area ............... ${r.topSubArea ?? "—"}`);
    console.log(`  normalised sub-scores (0-100):`);
    console.log(`    demand    = ${r.customers}/${maxCustomers} * 100 = ${r.demandScore.toFixed(1)}`);
    console.log(`    growth    = ${Math.max(0, r.growthPct ?? 0).toFixed(2)}/${maxGrowth.toFixed(2)} * 100 = ${r.growthScore.toFixed(1)}`);
    console.log(`    distance  = ${(r.avgTravelKm ?? 0).toFixed(2)}/${maxAvgTravel.toFixed(2)} * 100 = ${r.distanceScore.toFixed(1)}`);
    console.log(`    coverage  = ${(r.nearestBranchKm ?? 0).toFixed(2)}/${maxNearest.toFixed(2)} * 100 = ${r.coverageScore.toFixed(1)}`);
    console.log(`    repeat    = ${(r.repeatRate * 200).toFixed(1)} (capped at 100) = ${r.repeatScore.toFixed(1)}`);
    console.log(`  weighted total:`);
    console.log(
      `    ${r.demandScore.toFixed(1)} × ${WEIGHTS.demand} + ${r.growthScore.toFixed(1)} × ${WEIGHTS.growth} + ` +
        `${r.distanceScore.toFixed(1)} × ${WEIGHTS.distance} + ${r.coverageScore.toFixed(1)} × ${WEIGHTS.coverage} + ` +
        `${r.repeatScore.toFixed(1)} × ${WEIGHTS.repeat}`,
    );
    console.log(
      `    = ${(r.demandScore * WEIGHTS.demand).toFixed(2)} + ${(r.growthScore * WEIGHTS.growth).toFixed(2)} + ` +
        `${(r.distanceScore * WEIGHTS.distance).toFixed(2)} + ${(r.coverageScore * WEIGHTS.coverage).toFixed(2)} + ` +
        `${(r.repeatScore * WEIGHTS.repeat).toFixed(2)}`,
    );
    console.log(`    = ${r.confidence.toFixed(1)} / 100   ← confidence score`);
  }

  await client.end();
  console.log("\n✓ done");
}

main().catch(async (err) => {
  console.error("✗ failed:", err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
