import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  aggregateByArea,
  aggregateByBranch,
  aggregateByDistanceBucket,
  aggregateBySubArea,
} from "@/lib/analytics/aggregations";
import { generateInsights } from "@/lib/analytics/insights";
import {
  fetchActiveBranches,
  fetchAllAreas,
  fetchCustomers,
  fetchKpiSummary,
} from "@/lib/analytics/queries";
import { generateRecommendations } from "@/lib/analytics/recommendations";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI insights — Hyderabad Sweets",
};

export default async function InsightsPage() {
  const [kpis, customers, branches, areas] = await Promise.all([
    fetchKpiSummary(),
    fetchCustomers({ limit: 10000 }),
    fetchActiveBranches(),
    fetchAllAreas(),
  ]);

  const areaAgg = aggregateByArea(customers);
  const subAgg = aggregateBySubArea(customers);
  const distAgg = aggregateByDistanceBucket(customers);
  const branchAgg = aggregateByBranch(customers, branches);
  const recs = generateRecommendations(customers, branches, areas, { topN: 5 });
  const insights = generateInsights({
    kpis,
    areas: areaAgg,
    subAreas: subAgg,
    distance: distAgg,
    branchCatchment: branchAgg,
    recommendations: recs,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">AI insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rule-based takeaways generated from your customer data. Re-evaluated on every page load.
        </p>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <Lightbulb className="h-6 w-6" />
            <p>
              Once enough customer history is captured, insights about leading clusters, growth
              areas, distance trends, and expansion opportunities will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((i) => (
            <Card key={i.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="text-base">{i.headline}</CardTitle>
                <Badge
                  variant={
                    i.tone === "warning"
                      ? "warning"
                      : i.tone === "opportunity"
                        ? "gold"
                        : i.tone === "positive"
                          ? "success"
                          : "outline"
                  }
                >
                  {i.tone}
                </Badge>
              </CardHeader>
              {i.detail && (
                <CardContent className="pt-0">
                  <CardDescription>{i.detail}</CardDescription>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
