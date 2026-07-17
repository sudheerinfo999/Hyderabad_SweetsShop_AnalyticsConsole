// Branch Recommendation Engine
// =============================================================================
// Heuristic, fully explainable scoring of candidate areas for new branches.
// Designed to be deterministic and easy to debug; can be swapped for ML later.
//
// Inputs:
//   - customers (with main_area, sub_area, lat/lng, distance_km, created_at)
//   - existing branches
//   - master area list (with lat/lng)
//
// For each candidate area we compute:
//   - demandScore  : normalised customer volume in the area
//   - growthScore  : recent (30d) vs previous (30d) growth
//   - distanceScore: how far on average customers in that area currently travel
//   - coverageScore: how poorly current branches cover that area (min distance
//                    from area centroid to any active branch)
//   - repeatScore  : repeat customer ratio (same mobile shows up multiple times)
//
// We combine these into a 0-100 confidence score with documented weights.
// =============================================================================

import { haversineKm, type LatLng } from "@/lib/geo";
import type { Customer, HyderabadArea, ShopBranch } from "@/lib/supabase/types";

export interface Recommendation {
  area: string;
  zone: string;
  centroid: LatLng;
  customers: number;
  customersLast30d: number;
  customersPrev30d: number;
  growthPct: number | null;
  avgTravelKm: number | null;
  nearestBranchKm: number | null;
  estimatedReach: number;
  estimatedDistanceReductionKm: number | null;
  topSubArea: string | null;
  repeatCustomerRate: number;
  demandScore: number;
  growthScore: number;
  distanceScore: number;
  coverageScore: number;
  repeatScore: number;
  confidenceScore: number;
  reasons: string[];
}

const WEIGHTS = {
  demand: 0.4,
  growth: 0.18,
  distance: 0.16,
  coverage: 0.18,
  repeat: 0.08,
} as const;

const COVERAGE_RADIUS_KM = 3.5;
const NEW_BRANCH_REACH_RADIUS_KM = 4;

/**
 * Minimum number of customers required for an area to be considered a candidate
 * for a new branch. Without this, single-customer outliers in distant areas can
 * dominate the ranking because their normalised distance / coverage sub-scores
 * are 100/100 from just one data point.
 */
const MIN_CANDIDATE_CUSTOMERS = 2;

function normalise(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

interface AreaStats {
  area: HyderabadArea;
  customers: Customer[];
  customersLast30d: Customer[];
  customersPrev30d: Customer[];
  uniqueMobiles: Set<string>;
  repeatMobiles: Set<string>;
  subAreaCounts: Map<string, number>;
}

function bucketize(
  customers: Customer[],
  areas: HyderabadArea[],
): Map<string, AreaStats> {
  const now = Date.now();
  const thirty = 30 * 24 * 3600 * 1000;
  const map = new Map<string, AreaStats>();

  for (const area of areas) {
    map.set(area.area_name, {
      area,
      customers: [],
      customersLast30d: [],
      customersPrev30d: [],
      uniqueMobiles: new Set(),
      repeatMobiles: new Set(),
      subAreaCounts: new Map(),
    });
  }

  for (const c of customers) {
    const stats = map.get(c.main_area);
    if (!stats) continue;
    stats.customers.push(c);
    const t = new Date(c.created_at).getTime();
    if (now - t <= thirty) stats.customersLast30d.push(c);
    else if (now - t <= 2 * thirty) stats.customersPrev30d.push(c);

    if (c.mobile_number) {
      if (stats.uniqueMobiles.has(c.mobile_number)) {
        stats.repeatMobiles.add(c.mobile_number);
      } else {
        stats.uniqueMobiles.add(c.mobile_number);
      }
    }

    if (c.sub_area) {
      stats.subAreaCounts.set(c.sub_area, (stats.subAreaCounts.get(c.sub_area) ?? 0) + 1);
    }
  }

  return map;
}

function describeReasons(rec: Recommendation): string[] {
  const reasons: string[] = [];
  if (rec.customers > 0) {
    reasons.push(
      `${rec.customers} historical customers from ${rec.area} (${rec.customersLast30d} in the last 30 days).`,
    );
  }
  if (rec.growthPct != null) {
    if (rec.growthPct > 15) {
      reasons.push(`Demand growing fast: +${rec.growthPct.toFixed(1)}% vs the previous 30 days.`);
    } else if (rec.growthPct > 0) {
      reasons.push(`Demand trending up: +${rec.growthPct.toFixed(1)}% vs the previous 30 days.`);
    }
  }
  if (rec.avgTravelKm != null && rec.avgTravelKm > 4) {
    reasons.push(
      `Average customer currently travels ~${rec.avgTravelKm.toFixed(1)} km to reach an existing branch.`,
    );
  }
  if (rec.nearestBranchKm != null && rec.nearestBranchKm > COVERAGE_RADIUS_KM) {
    reasons.push(
      `Nearest existing branch is ${rec.nearestBranchKm.toFixed(1)} km away — under-served area.`,
    );
  }
  if (rec.repeatCustomerRate > 0.15) {
    reasons.push(
      `Strong loyalty signal: ${(rec.repeatCustomerRate * 100).toFixed(0)}% of customers here return.`,
    );
  }
  if (rec.topSubArea) {
    reasons.push(`Hotspot sub-area: ${rec.topSubArea}.`);
  }
  if (reasons.length === 0) {
    reasons.push("Underserved area within HMR with growth potential — worth monitoring.");
  }
  return reasons;
}

export interface RecommendOptions {
  topN?: number;
  excludeAreas?: string[];
}

export function generateRecommendations(
  customers: Customer[],
  branches: ShopBranch[],
  areas: HyderabadArea[],
  opts: RecommendOptions = {},
): Recommendation[] {
  const topN = opts.topN ?? 3;
  const exclude = new Set(opts.excludeAreas ?? []);

  // Don't recommend areas that already host an active branch.
  const branchAreaNames = new Set(
    branches.filter((b) => b.is_active).map((b) => b.main_area.toLowerCase()),
  );

  const stats = bucketize(customers, areas);

  // First pass: collect raw numbers + maxima for normalisation.
  const raw: Array<{
    area: HyderabadArea;
    customers: number;
    customersLast30d: number;
    customersPrev30d: number;
    growthPct: number | null;
    avgTravelKm: number | null;
    nearestBranchKm: number | null;
    repeatRate: number;
    topSubArea: string | null;
  }> = [];

  for (const s of stats.values()) {
    if (branchAreaNames.has(s.area.area_name.toLowerCase())) continue;
    if (exclude.has(s.area.area_name)) continue;
    if (!s.area.is_active) continue;
    // Filter out areas with too little data — one customer can otherwise dominate
    // the distance and coverage sub-scores even though we don't have a real signal.
    if (s.customers.length < MIN_CANDIDATE_CUSTOMERS) continue;

    const c30 = s.customersLast30d.length;
    const cPrev = s.customersPrev30d.length;
    const growthPct =
      c30 === 0 && cPrev === 0
        ? null
        : cPrev === 0
          ? 100
          : ((c30 - cPrev) / cPrev) * 100;

    let distSum = 0;
    let distCount = 0;
    for (const c of s.customers) {
      if (c.distance_km != null) {
        distSum += Number(c.distance_km);
        distCount += 1;
      }
    }
    const avgTravelKm = distCount > 0 ? distSum / distCount : null;

    let nearestBranchKm: number | null = null;
    if (branches.length > 0) {
      nearestBranchKm = Number.POSITIVE_INFINITY;
      for (const b of branches) {
        if (!b.is_active) continue;
        const d = haversineKm(
          { latitude: s.area.latitude, longitude: s.area.longitude },
          { latitude: b.latitude, longitude: b.longitude },
        );
        if (d < nearestBranchKm) nearestBranchKm = d;
      }
      if (!Number.isFinite(nearestBranchKm)) nearestBranchKm = null;
    }

    const uniqueCount = s.uniqueMobiles.size;
    const repeatRate = uniqueCount > 0 ? s.repeatMobiles.size / uniqueCount : 0;

    let topSubArea: string | null = null;
    let topSubCount = 0;
    for (const [name, count] of s.subAreaCounts) {
      if (count > topSubCount) {
        topSubCount = count;
        topSubArea = name;
      }
    }

    raw.push({
      area: s.area,
      customers: s.customers.length,
      customersLast30d: c30,
      customersPrev30d: cPrev,
      growthPct,
      avgTravelKm,
      nearestBranchKm,
      repeatRate,
      topSubArea,
    });
  }

  const maxCustomers = Math.max(1, ...raw.map((r) => r.customers));
  const maxGrowthPct = Math.max(1, ...raw.map((r) => r.growthPct ?? 0));
  const maxAvgTravel = Math.max(1, ...raw.map((r) => r.avgTravelKm ?? 0));
  const maxNearest = Math.max(1, ...raw.map((r) => r.nearestBranchKm ?? 0));

  const recommendations: Recommendation[] = raw.map((r) => {
    const demandScore = normalise(r.customers, maxCustomers);
    const growthScore = normalise(Math.max(0, r.growthPct ?? 0), maxGrowthPct);
    const distanceScore = normalise(r.avgTravelKm ?? 0, maxAvgTravel);
    const coverageScore = normalise(r.nearestBranchKm ?? 0, maxNearest);
    const repeatScore = Math.min(100, r.repeatRate * 200);

    const confidenceScore = Number(
      (
        demandScore * WEIGHTS.demand +
        growthScore * WEIGHTS.growth +
        distanceScore * WEIGHTS.distance +
        coverageScore * WEIGHTS.coverage +
        repeatScore * WEIGHTS.repeat
      ).toFixed(1),
    );

    const estimatedDistanceReductionKm =
      r.avgTravelKm != null && r.avgTravelKm > 1.5
        ? Number(Math.max(0, r.avgTravelKm - 1.5).toFixed(2))
        : null;

    const rec: Recommendation = {
      area: r.area.area_name,
      zone: r.area.zone_name,
      centroid: { latitude: r.area.latitude, longitude: r.area.longitude },
      customers: r.customers,
      customersLast30d: r.customersLast30d,
      customersPrev30d: r.customersPrev30d,
      growthPct: r.growthPct == null ? null : Number(r.growthPct.toFixed(1)),
      avgTravelKm: r.avgTravelKm == null ? null : Number(r.avgTravelKm.toFixed(2)),
      nearestBranchKm: r.nearestBranchKm == null ? null : Number(r.nearestBranchKm.toFixed(2)),
      estimatedReach: Math.max(r.customers, r.customersLast30d * 3),
      estimatedDistanceReductionKm,
      topSubArea: r.topSubArea,
      repeatCustomerRate: Number(r.repeatRate.toFixed(2)),
      demandScore: Number(demandScore.toFixed(1)),
      growthScore: Number(growthScore.toFixed(1)),
      distanceScore: Number(distanceScore.toFixed(1)),
      coverageScore: Number(coverageScore.toFixed(1)),
      repeatScore: Number(repeatScore.toFixed(1)),
      confidenceScore,
      reasons: [],
    };
    rec.reasons = describeReasons(rec);
    return rec;
  });

  recommendations.sort((a, b) => b.confidenceScore - a.confidenceScore);
  return recommendations.slice(0, topN);
}

export const RECOMMENDATION_DEFAULT_COVERAGE_RADIUS_KM = NEW_BRANCH_REACH_RADIUS_KM;
export const RECOMMENDATION_WEIGHTS = WEIGHTS;
export const RECOMMENDATION_MIN_CANDIDATE_CUSTOMERS = MIN_CANDIDATE_CUSTOMERS;
