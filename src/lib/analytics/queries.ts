import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Customer,
  HyderabadArea,
  HyderabadSubArea,
  ShopBranch,
} from "@/lib/supabase/types";

// Time windows (server-resolved so they line up with Supabase data).
export function nowIso() {
  return new Date().toISOString();
}

export function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function fetchAllAreas(): Promise<HyderabadArea[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hyderabad_areas")
    .select("*")
    .order("area_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllSubAreas(): Promise<HyderabadSubArea[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hyderabad_sub_areas")
    .select("*")
    .order("sub_area_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveBranches(): Promise<ShopBranch[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shop_branches")
    .select("*")
    .order("branch_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCustomers(opts?: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Customer[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (opts?.from) q = q.gte("created_at", opts.from);
  if (opts?.to) q = q.lte("created_at", opts.to);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export interface KpiSummary {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  totalCount: number;
  avgDistance: number | null;
  totalRevenue: number;
  topArea: { area: string; count: number } | null;
  topSubArea: { subArea: string; mainArea: string; count: number } | null;
  fastestGrowingArea: { area: string; growthPct: number; current: number; previous: number } | null;
}

export async function fetchKpiSummary(): Promise<KpiSummary> {
  const supabase = await createSupabaseServerClient();
  const [{ data: all, error }] = await Promise.all([
    supabase.from("customers").select("created_at, main_area, sub_area, distance_km, purchase_amount"),
  ]);
  if (error) throw error;

  const rows = (all ?? []) as Array<{
    created_at: string;
    main_area: string;
    sub_area: string | null;
    distance_km: number | null;
    purchase_amount: number | null;
  }>;

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * 24 * 3600 * 1000);
  const monthStart = new Date(now - 30 * 24 * 3600 * 1000);
  const prevMonthStart = new Date(now - 60 * 24 * 3600 * 1000);

  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  let distSum = 0;
  let distCount = 0;
  let totalRevenue = 0;
  const areaCounts = new Map<string, number>();
  const subAreaCounts = new Map<string, { count: number; mainArea: string }>();
  const areaCurrent = new Map<string, number>();
  const areaPrevious = new Map<string, number>();

  for (const r of rows) {
    const createdAt = new Date(r.created_at);
    if (createdAt >= todayStart) todayCount += 1;
    if (createdAt >= weekStart) weekCount += 1;
    if (createdAt >= monthStart) {
      monthCount += 1;
      areaCurrent.set(r.main_area, (areaCurrent.get(r.main_area) ?? 0) + 1);
    } else if (createdAt >= prevMonthStart) {
      areaPrevious.set(r.main_area, (areaPrevious.get(r.main_area) ?? 0) + 1);
    }
    if (r.distance_km != null) {
      distSum += Number(r.distance_km);
      distCount += 1;
    }
    if (r.purchase_amount != null) totalRevenue += Number(r.purchase_amount);

    areaCounts.set(r.main_area, (areaCounts.get(r.main_area) ?? 0) + 1);
    if (r.sub_area) {
      const key = `${r.main_area}::${r.sub_area}`;
      const prev = subAreaCounts.get(key);
      subAreaCounts.set(key, {
        count: (prev?.count ?? 0) + 1,
        mainArea: r.main_area,
      });
    }
  }

  let topArea: KpiSummary["topArea"] = null;
  for (const [area, count] of areaCounts) {
    if (!topArea || count > topArea.count) topArea = { area, count };
  }

  let topSubArea: KpiSummary["topSubArea"] = null;
  for (const [key, { count, mainArea }] of subAreaCounts) {
    const subArea = key.split("::")[1];
    if (!topSubArea || count > topSubArea.count) topSubArea = { subArea, mainArea, count };
  }

  let fastestGrowingArea: KpiSummary["fastestGrowingArea"] = null;
  for (const [area, current] of areaCurrent) {
    if (current < 3) continue; // require a baseline so % isn't noisy
    const previous = areaPrevious.get(area) ?? 0;
    const growthPct = previous === 0 ? 100 : ((current - previous) / previous) * 100;
    if (!fastestGrowingArea || growthPct > fastestGrowingArea.growthPct) {
      fastestGrowingArea = { area, growthPct, current, previous };
    }
  }

  return {
    todayCount,
    weekCount,
    monthCount,
    totalCount: rows.length,
    avgDistance: distCount > 0 ? Number((distSum / distCount).toFixed(2)) : null,
    totalRevenue,
    topArea,
    topSubArea,
    fastestGrowingArea,
  };
}
