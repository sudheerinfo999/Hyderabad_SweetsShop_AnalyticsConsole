import { ArrowDownRight, ArrowUpRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaBarChart } from "@/components/charts/area-bar-chart";
import { DistancePieChart } from "@/components/charts/distance-pie-chart";
import {
  aggregateByArea,
  aggregateByBranch,
  aggregateByDistanceBucket,
  aggregateBySubArea,
} from "@/lib/analytics/aggregations";
import { fetchActiveBranches, fetchCustomers } from "@/lib/analytics/queries";
import { formatCurrency, formatKm, formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics — Hyderabad Sweets",
};

export default async function AnalyticsPage() {
  const [customers, branches] = await Promise.all([
    fetchCustomers({ limit: 10000 }),
    fetchActiveBranches(),
  ]);

  const areaAgg = aggregateByArea(customers);
  const subAreaAgg = aggregateBySubArea(customers);
  const distanceAgg = aggregateByDistanceBucket(customers);
  const branchAgg = aggregateByBranch(customers, branches);
  const areaChart = areaAgg.slice(0, 10).map(({ area, count }) => ({ area, count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demand by area, sub-area, travel distance, and branch catchment.
        </p>
      </div>

      <Tabs defaultValue="area">
        <TabsList>
          <TabsTrigger value="area">Areas</TabsTrigger>
          <TabsTrigger value="sub">Sub-areas</TabsTrigger>
          <TabsTrigger value="distance">Distance</TabsTrigger>
          <TabsTrigger value="branch">Branches</TabsTrigger>
        </TabsList>

        <TabsContent value="area" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 areas</CardTitle>
              <CardDescription>Customer count per area</CardDescription>
            </CardHeader>
            <CardContent>
              {areaChart.length === 0 ? (
                <div className="grid h-72 place-items-center text-sm text-muted-foreground">
                  Add customers to populate this view.
                </div>
              ) : (
                <AreaBarChart data={areaChart} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Area breakdown</CardTitle>
              <CardDescription>Share, growth, average travel distance</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg distance</TableHead>
                    <TableHead className="text-right">30d growth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areaAgg.map((a) => (
                    <TableRow key={a.area}>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {a.area}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(a.count)}</TableCell>
                      <TableCell className="text-right">{formatPercent(a.sharePct)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(a.revenue)}</TableCell>
                      <TableCell className="text-right">
                        {a.avgDistanceKm == null ? "—" : formatKm(a.avgDistanceKm)}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.growthPct == null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              a.growthPct >= 0
                                ? "inline-flex items-center text-emerald-600"
                                : "inline-flex items-center text-rose-600"
                            }
                          >
                            {a.growthPct >= 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {a.growthPct.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sub" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sub-area leaderboard</CardTitle>
              <CardDescription>
                Top contributing colonies, nagars &amp; sub-localities
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sub-area</TableHead>
                    <TableHead>Main area</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subAreaAgg.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No sub-area data yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    subAreaAgg.slice(0, 30).map((s) => (
                      <TableRow key={`${s.mainArea}-${s.subArea}`}>
                        <TableCell className="font-medium">{s.subArea}</TableCell>
                        <TableCell>{s.mainArea}</TableCell>
                        <TableCell className="text-right">{formatNumber(s.count)}</TableCell>
                        <TableCell className="text-right">{formatPercent(s.sharePct)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distance" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distance buckets</CardTitle>
                <CardDescription>How far customers travel to a branch</CardDescription>
              </CardHeader>
              <CardContent>
                <DistancePieChart data={distanceAgg} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Breakdown</CardTitle>
                <CardDescription>Counts &amp; percentages</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bucket</TableHead>
                      <TableHead className="text-right">Customers</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distanceAgg.map((b) => (
                      <TableRow key={b.bucket}>
                        <TableCell>
                          <Badge variant="outline">{b.bucket}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(b.count)}</TableCell>
                        <TableCell className="text-right">{formatPercent(b.sharePct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="branch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branch catchment</CardTitle>
              <CardDescription>Customers, revenue, and average travel by branch</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Avg distance</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchAgg.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No branches yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branchAgg.map((b) => (
                      <TableRow key={b.branchId ?? "unassigned"}>
                        <TableCell className="font-medium">{b.branchName}</TableCell>
                        <TableCell className="text-right">{formatNumber(b.count)}</TableCell>
                        <TableCell className="text-right">
                          {b.avgDistanceKm == null ? "—" : formatKm(b.avgDistanceKm)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(b.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
