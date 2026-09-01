import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Customer,
  HyderabadArea,
  HyderabadSubArea,
  ShopBranch,
} from "@/lib/supabase/types";

export function nowIso() {
  return new Date().toISOString();
}

export function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const fetchAreasCached = unstable_cache(
  async (): Promise<HyderabadArea[]> => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("hyderabad_areas")
      .select("*")
      .order("area_name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  ["master-areas"],
  { revalidate: 300, tags: [CACHE_TAGS.masterData] },
);

const fetchSubAreasCached = unstable_cache(
  async (): Promise<HyderabadSubArea[]> => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("hyderabad_sub_areas")
      .select("*")
      .order("sub_area_name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  ["master-sub-areas"],
  { revalidate: 300, tags: [CACHE_TAGS.masterData] },
);

const fetchBranchesCached = unstable_cache(
  async (): Promise<ShopBranch[]> => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("shop_branches")
      .select("*")
      .order("branch_name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  ["shop-branches"],
  { revalidate: 300, tags: [CACHE_TAGS.masterData] },
);

export async function fetchAllAreas(): Promise<HyderabadArea[]> {
  return fetchAreasCached();
}

export async function fetchAllSubAreas(): Promise<HyderabadSubArea[]> {
  return fetchSubAreasCached();
}

export async function fetchActiveBranches(): Promise<ShopBranch[]> {
  return fetchBranchesCached();
}

const fetchAnalyticsCustomersCached = (limit: number) =>
  unstable_cache(
    async (): Promise<Customer[]> => {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    ["analytics-customers", String(limit)],
    { revalidate: 120, tags: [CACHE_TAGS.analytics] },
  )();

/** Cached customer slice for dashboard, analytics, map, and reports (admin pages). */
export async function fetchAnalyticsCustomers(limit = 5000): Promise<Customer[]> {
  return fetchAnalyticsCustomersCached(limit);
}

/** Cached active area names for fast server-side validation on counter save. */
export const getActiveAreaNames = cache(async (): Promise<Set<string>> => {
  const areas = await fetchAllAreas();
  return new Set(areas.filter((a) => a.is_active).map((a) => a.area_name));
});

export const fetchCustomers = cache(async function fetchCustomers(opts?: {
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
});

export const fetchCustomerVisits = cache(async function fetchCustomerVisits(opts?: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<
  Array<{ id: string; customer_id: string; purchase_amount: number | null; created_at: string }>
> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("customer_visits")
    .select("id, customer_id, purchase_amount, created_at")
    .order("created_at", { ascending: false });
  if (opts?.from) q = q.gte("created_at", opts.from);
  if (opts?.to) q = q.lte("created_at", opts.to);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
});

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

export const fetchKpiSummary = cache(async function fetchKpiSummary(): Promise<KpiSummary> {
  return fetchKpiSummaryCached();
});

const fetchKpiSummaryCached = unstable_cache(
  async (): Promise<KpiSummary> => {
  const supabase = await createSupabaseServerClient();
  const sixtyDaysAgo = daysAgoIso(60);

  const [
    { count: totalCount, error: countErr },
    { data: customerRows, error: custErr },
    { data: visitRows, error: visitErr },
    { data: revenueRows, error: revErr },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase
      .from("customers")
      .select("created_at, main_area, sub_area, distance_km")
      .gte("created_at", sixtyDaysAgo),
    supabase
      .from("customer_visits")
      .select("created_at, purchase_amount")
      .gte("created_at", sixtyDaysAgo),
    supabase.from("customers").select("purchase_amount"),
  ]);

  if (countErr) throw countErr;
  if (custErr) throw custErr;
  if (visitErr) throw visitErr;
  if (revErr) throw revErr;

  const rows = customerRows ?? [];
  const visits = visitRows ?? [];

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * 24 * 3600 * 1000);
  const monthStart = new Date(now - 30 * 24 * 3600 * 1000);
  const prevMonthStart = new Date(now - 60 * 24 * 3600 * 1000);

  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  for (const v of visits) {
    const createdAt = new Date(v.created_at);
    if (createdAt >= todayStart) todayCount += 1;
    if (createdAt >= weekStart) weekCount += 1;
    if (createdAt >= monthStart) monthCount += 1;
  }

  let distSum = 0;
  let distCount = 0;
  let totalRevenue = 0;
  const areaCounts = new Map<string, number>();
  const subAreaCounts = new Map<string, { count: number; mainArea: string }>();
  const areaCurrent = new Map<string, number>();
  const areaPrevious = new Map<string, number>();

  for (const r of revenueRows ?? []) {
    if (r.purchase_amount != null) totalRevenue += Number(r.purchase_amount);
  }

  for (const r of rows) {
    const createdAt = new Date(r.created_at);
    if (createdAt >= monthStart) {
      areaCurrent.set(r.main_area, (areaCurrent.get(r.main_area) ?? 0) + 1);
    } else if (createdAt >= prevMonthStart) {
      areaPrevious.set(r.main_area, (areaPrevious.get(r.main_area) ?? 0) + 1);
    }
    if (r.distance_km != null) {
      distSum += Number(r.distance_km);
      distCount += 1;
    }

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
    if (current < 3) continue;
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
    totalCount: totalCount ?? 0,
    avgDistance: distCount > 0 ? Number((distSum / distCount).toFixed(2)) : null,
    totalRevenue,
    topArea,
    topSubArea,
    fastestGrowingArea,
  };
  },
  ["kpi-summary"],
  { revalidate: 120, tags: [CACHE_TAGS.analytics] },
);
