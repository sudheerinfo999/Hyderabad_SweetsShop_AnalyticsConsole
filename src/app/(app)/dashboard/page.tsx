import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Route,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AreaBarChart } from "@/components/charts/area-bar-chart";
import { DailyTrendChart } from "@/components/charts/daily-trend-chart";
import { DistancePieChart } from "@/components/charts/distance-pie-chart";
import {
  aggregateByArea,
  aggregateByDistanceBucket,
  aggregateBySubArea,
  aggregateDaily,
} from "@/lib/analytics/aggregations";
import {
  fetchActiveBranches,
  fetchAllAreas,
  fetchCustomers,
  fetchKpiSummary,
} from "@/lib/analytics/queries";
import { generateRecommendations } from "@/lib/analytics/recommendations";
import { generateInsights } from "@/lib/analytics/insights";
import { formatCurrency, formatKm, formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [kpis, customers, branches, areasMaster] = await Promise.all([
    fetchKpiSummary(),
    fetchCustomers({ limit: 5000 }),
    fetchActiveBranches(),
    fetchAllAreas(),
  ]);

  const areaAgg = aggregateByArea(customers);
  const subAreaAgg = aggregateBySubArea(customers);
  const distanceAgg = aggregateByDistanceBucket(customers);
  const dailyAgg = aggregateDaily(customers, 30);
  const topAreasChart = areaAgg.slice(0, 8).map(({ area, count }) => ({ area, count }));
  const recommendations = generateRecommendations(customers, branches, areasMaster, { topN: 3 });
  const insights = generateInsights({
    kpis,
    areas: areaAgg,
    subAreas: subAreaAgg,
    distance: distanceAgg,
    branchCatchment: [],
    recommendations,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live customer demand across Hyderabad, Secunderabad &amp; HMR.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">View Reports</Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/customers/new">Add Customer</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Today"
          value={formatNumber(kpis.todayCount)}
          icon={CalendarDays}
          helper={`${formatNumber(kpis.weekCount)} this week`}
          accent="maroon"
        />
        <KpiCard
          label="Last 30 days"
          value={formatNumber(kpis.monthCount)}
          icon={Users}
          helper={`${formatNumber(kpis.totalCount)} total customers`}
          accent="gold"
        />
        <KpiCard
          label="Avg distance"
          value={kpis.avgDistance != null ? formatKm(kpis.avgDistance) : "—"}
          icon={Route}
          helper={kpis.avgDistance && kpis.avgDistance > 5 ? "High — open new branch?" : "Healthy"}
        />
        <KpiCard
          label="Revenue logged"
          value={formatCurrency(kpis.totalRevenue || 0)}
          icon={TrendingUp}
          helper={kpis.fastestGrowingArea ? `Fastest: ${kpis.fastestGrowingArea.area}` : "Awaiting data"}
          trend={kpis.fastestGrowingArea?.growthPct ?? null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Daily customer trend</CardTitle>
              <CardDescription>Last 30 days of customer entries</CardDescription>
            </div>
            <Badge variant="outline">{formatNumber(kpis.monthCount)} customers</Badge>
          </CardHeader>
          <CardContent>
            <DailyTrendChart data={dailyAgg} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distance distribution</CardTitle>
            <CardDescription>How far customers travel</CardDescription>
          </CardHeader>
          <CardContent>
            <DistancePieChart data={distanceAgg} />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {distanceAgg.map((b) => (
                <div key={b.bucket} className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1">
                  <span>{b.bucket}</span>
                  <span className="font-medium text-foreground">{formatPercent(b.sharePct, 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top areas by customer count</CardTitle>
            <CardDescription>Share of demand across the city</CardDescription>
          </CardHeader>
          <CardContent>
            {topAreasChart.length === 0 ? (
              <div className="grid h-72 place-items-center text-sm text-muted-foreground">
                Add some customers to see this chart.
              </div>
            ) : (
              <AreaBarChart data={topAreasChart} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>AI insights</CardTitle>
              <CardDescription>Auto-generated takeaways</CardDescription>
            </div>
            <Sparkles className="h-4 w-4 text-brand-gold" />
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Insights will appear here once enough customer data has been collected.
              </p>
            )}
            {insights.slice(0, 5).map((i) => (
              <div key={i.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-start gap-2">
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
                  <p className="text-sm font-medium">{i.headline}</p>
                </div>
                {i.detail && <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>}
              </div>
            ))}
            <Button asChild variant="ghost" size="sm" className="w-full justify-between">
              <Link href="/insights">
                View all insights <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Top 3 recommended expansion areas</CardTitle>
            <CardDescription>Heuristic blend of demand, growth, travel distance &amp; coverage</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/recommendations">
              Open Recommendations <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Once you add customers and branches we&apos;ll surface up to 3 expansion candidates here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Customers / 30d</TableHead>
                  <TableHead>Growth</TableHead>
                  <TableHead>Avg travel</TableHead>
                  <TableHead>Nearest branch</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((r, idx) => (
                  <TableRow key={r.area}>
                    <TableCell>
                      <div className="font-medium">
                        #{idx + 1}{" "}
                        <Link href={`/recommendations#${r.area}`} className="hover:underline">
                          {r.area}
                        </Link>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {r.zone}
                        {r.topSubArea && <span> · Hotspot: {r.topSubArea}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="maroon">{r.confidenceScore.toFixed(0)}/100</Badge>
                    </TableCell>
                    <TableCell>
                      {r.customersLast30d} <span className="text-muted-foreground">/ {r.customers} total</span>
                    </TableCell>
                    <TableCell>
                      {r.growthPct == null ? "—" : `${r.growthPct > 0 ? "+" : ""}${r.growthPct.toFixed(0)}%`}
                    </TableCell>
                    <TableCell>{r.avgTravelKm == null ? "—" : formatKm(r.avgTravelKm)}</TableCell>
                    <TableCell>{r.nearestBranchKm == null ? "—" : formatKm(r.nearestBranchKm)}</TableCell>
                    <TableCell className="text-right">~{formatNumber(r.estimatedReach)} customers</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
