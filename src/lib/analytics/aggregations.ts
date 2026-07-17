import { distanceBucket } from "@/lib/geo";
import type { Customer } from "@/lib/supabase/types";

export interface AreaAggregate {
  area: string;
  count: number;
  revenue: number;
  sharePct: number;
  avgDistanceKm: number | null;
  growthPct: number | null;     // current 30d vs previous 30d
  currentWindow: number;
  previousWindow: number;
}

export interface SubAreaAggregate {
  subArea: string;
  mainArea: string;
  count: number;
  revenue: number;
  sharePct: number;
}

export interface DistanceBucketAggregate {
  bucket: string;
  count: number;
  sharePct: number;
}

export interface BranchCatchmentAggregate {
  branchId: string | null;
  branchName: string;
  count: number;
  avgDistanceKm: number | null;
  revenue: number;
}

export interface DailyPoint {
  date: string;
  count: number;
  revenue: number;
}

export function aggregateByArea(customers: Customer[]): AreaAggregate[] {
  const now = Date.now();
  const currentStart = now - 30 * 24 * 3600 * 1000;
  const prevStart = now - 60 * 24 * 3600 * 1000;

  const buckets = new Map<
    string,
    {
      count: number;
      revenue: number;
      distSum: number;
      distCount: number;
      current: number;
      previous: number;
    }
  >();

  let total = 0;
  for (const c of customers) {
    total += 1;
    const t = new Date(c.created_at).getTime();
    const entry = buckets.get(c.main_area) ?? {
      count: 0,
      revenue: 0,
      distSum: 0,
      distCount: 0,
      current: 0,
      previous: 0,
    };
    entry.count += 1;
    entry.revenue += Number(c.purchase_amount ?? 0);
    if (c.distance_km != null) {
      entry.distSum += Number(c.distance_km);
      entry.distCount += 1;
    }
    if (t >= currentStart) entry.current += 1;
    else if (t >= prevStart) entry.previous += 1;
    buckets.set(c.main_area, entry);
  }

  return Array.from(buckets.entries())
    .map(([area, v]) => {
      const growthPct =
        v.current === 0 && v.previous === 0
          ? null
          : v.previous === 0
            ? 100
            : ((v.current - v.previous) / v.previous) * 100;
      return {
        area,
        count: v.count,
        revenue: v.revenue,
        sharePct: total > 0 ? (v.count / total) * 100 : 0,
        avgDistanceKm: v.distCount > 0 ? Number((v.distSum / v.distCount).toFixed(2)) : null,
        growthPct: growthPct == null ? null : Number(growthPct.toFixed(1)),
        currentWindow: v.current,
        previousWindow: v.previous,
      } satisfies AreaAggregate;
    })
    .sort((a, b) => b.count - a.count);
}

export function aggregateBySubArea(customers: Customer[]): SubAreaAggregate[] {
  const buckets = new Map<string, { count: number; revenue: number; mainArea: string }>();
  let total = 0;
  for (const c of customers) {
    if (!c.sub_area) continue;
    total += 1;
    const key = `${c.main_area}::${c.sub_area}`;
    const entry = buckets.get(key) ?? { count: 0, revenue: 0, mainArea: c.main_area };
    entry.count += 1;
    entry.revenue += Number(c.purchase_amount ?? 0);
    buckets.set(key, entry);
  }
  return Array.from(buckets.entries())
    .map(([key, v]) => {
      const [, subArea] = key.split("::");
      return {
        subArea,
        mainArea: v.mainArea,
        count: v.count,
        revenue: v.revenue,
        sharePct: total > 0 ? (v.count / total) * 100 : 0,
      } satisfies SubAreaAggregate;
    })
    .sort((a, b) => b.count - a.count);
}

export function aggregateByDistanceBucket(customers: Customer[]): DistanceBucketAggregate[] {
  const buckets = new Map<string, number>();
  let total = 0;
  for (const c of customers) {
    if (c.distance_km == null) continue;
    total += 1;
    const b = distanceBucket(Number(c.distance_km));
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  return ["0–2 km", "2–5 km", "5–10 km", "10+ km"].map((bucket) => {
    const count = buckets.get(bucket) ?? 0;
    return {
      bucket,
      count,
      sharePct: total > 0 ? (count / total) * 100 : 0,
    } satisfies DistanceBucketAggregate;
  });
}

export function aggregateByBranch(
  customers: Customer[],
  branches: { id: string; branch_name: string }[],
): BranchCatchmentAggregate[] {
  const lookup = new Map(branches.map((b) => [b.id, b.branch_name]));
  const buckets = new Map<
    string,
    { count: number; revenue: number; distSum: number; distCount: number }
  >();
  for (const c of customers) {
    const key = c.nearest_branch_id ?? "__unassigned__";
    const entry = buckets.get(key) ?? { count: 0, revenue: 0, distSum: 0, distCount: 0 };
    entry.count += 1;
    entry.revenue += Number(c.purchase_amount ?? 0);
    if (c.distance_km != null) {
      entry.distSum += Number(c.distance_km);
      entry.distCount += 1;
    }
    buckets.set(key, entry);
  }
  return Array.from(buckets.entries())
    .map(([id, v]) => ({
      branchId: id === "__unassigned__" ? null : id,
      branchName: id === "__unassigned__" ? "Unassigned" : (lookup.get(id) ?? "Unknown"),
      count: v.count,
      revenue: v.revenue,
      avgDistanceKm: v.distCount > 0 ? Number((v.distSum / v.distCount).toFixed(2)) : null,
    }))
    .sort((a, b) => b.count - a.count);
}

export function aggregateDaily(customers: Customer[], days = 30): DailyPoint[] {
  const points = new Map<string, { count: number; revenue: number }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    points.set(d.toISOString().slice(0, 10), { count: 0, revenue: 0 });
  }

  for (const c of customers) {
    const key = new Date(c.created_at).toISOString().slice(0, 10);
    const point = points.get(key);
    if (!point) continue;
    point.count += 1;
    point.revenue += Number(c.purchase_amount ?? 0);
  }

  return Array.from(points.entries()).map(([date, v]) => ({
    date,
    count: v.count,
    revenue: v.revenue,
  }));
}
