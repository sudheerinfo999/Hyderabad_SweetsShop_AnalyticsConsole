// Heuristic, explainable "AI Insights" — narrate the analytics in plain English.
// Designed to be replaced with an LLM later without rewriting consumers.

import type {
  AreaAggregate,
  BranchCatchmentAggregate,
  DistanceBucketAggregate,
  SubAreaAggregate,
} from "@/lib/analytics/aggregations";
import type { KpiSummary } from "@/lib/analytics/queries";
import type { Recommendation } from "@/lib/analytics/recommendations";

export type InsightTone = "info" | "positive" | "warning" | "opportunity";

export interface Insight {
  id: string;
  tone: InsightTone;
  headline: string;
  detail?: string;
}

export function generateInsights(input: {
  kpis: KpiSummary;
  areas: AreaAggregate[];
  subAreas: SubAreaAggregate[];
  distance: DistanceBucketAggregate[];
  branchCatchment: BranchCatchmentAggregate[];
  recommendations: Recommendation[];
}): Insight[] {
  const insights: Insight[] = [];
  const { kpis, areas, subAreas, distance, branchCatchment, recommendations } = input;

  if (areas.length > 0) {
    const top = areas[0];
    if (top.sharePct >= 5) {
      insights.push({
        id: "top-area",
        tone: "info",
        headline: `${top.area} cluster contributes ${top.sharePct.toFixed(1)}% of all customers.`,
        detail:
          top.avgDistanceKm != null
            ? `Average travel distance from ${top.area}: ${top.avgDistanceKm.toFixed(1)} km.`
            : undefined,
      });
    }
  }

  const growing = areas
    .filter((a) => a.growthPct != null && a.growthPct >= 15 && a.currentWindow >= 3)
    .sort((a, b) => (b.growthPct ?? 0) - (a.growthPct ?? 0))
    .slice(0, 2);

  for (const a of growing) {
    insights.push({
      id: `growth-${a.area}`,
      tone: "positive",
      headline: `${a.area} demand increased ${a.growthPct!.toFixed(0)}% this month.`,
      detail: `${a.currentWindow} customers in the last 30 days vs ${a.previousWindow} in the prior 30.`,
    });
  }

  if (kpis.avgDistance != null && kpis.avgDistance > 5) {
    insights.push({
      id: "avg-distance-high",
      tone: "warning",
      headline: `Average customer travels ${kpis.avgDistance.toFixed(1)} km to reach a branch.`,
      detail: "A new branch in an under-served area could materially reduce this.",
    });
  }

  if (subAreas.length > 0) {
    const top = subAreas[0];
    if (top.count >= 5) {
      insights.push({
        id: "top-sub-area",
        tone: "info",
        headline: `${top.subArea} (${top.mainArea}) is the leading sub-area with ${top.count} customers.`,
      });
    }
  }

  const farBucket = distance.find((b) => b.bucket === "10+ km");
  if (farBucket && farBucket.sharePct >= 10) {
    insights.push({
      id: "far-customers",
      tone: "warning",
      headline: `${farBucket.sharePct.toFixed(0)}% of customers come from more than 10 km away.`,
      detail: "These trips are likely seasonal or destination visits — high churn risk.",
    });
  }

  for (const rec of recommendations.slice(0, 2)) {
    const piece =
      rec.estimatedDistanceReductionKm != null && rec.estimatedDistanceReductionKm > 0
        ? `could reduce average travel by ~${rec.estimatedDistanceReductionKm.toFixed(1)} km`
        : `is a strong fit with a confidence of ${rec.confidenceScore.toFixed(0)}/100`;
    insights.push({
      id: `rec-${rec.area}`,
      tone: "opportunity",
      headline: `Opening near ${rec.area} ${piece}.`,
      detail: rec.reasons[0],
    });
  }

  if (branchCatchment.length > 1) {
    const sorted = [...branchCatchment].sort((a, b) => b.count - a.count);
    const [busiest, ...rest] = sorted;
    if (busiest && rest.length > 0 && busiest.count > 0) {
      const avgRest =
        rest.reduce((sum, b) => sum + b.count, 0) / rest.length;
      if (avgRest > 0 && busiest.count > avgRest * 1.5) {
        insights.push({
          id: `busiest-branch`,
          tone: "info",
          headline: `${busiest.branchName} is your busiest catchment with ${busiest.count} customers.`,
          detail: "Consider load-balancing with a nearby new branch if growth continues.",
        });
      }
    }
  }

  return insights;
}
