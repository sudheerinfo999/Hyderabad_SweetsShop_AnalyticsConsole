import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CityMap } from "@/components/map/city-map";
import { aggregateByArea } from "@/lib/analytics/aggregations";
import { fetchActiveBranches, fetchAllAreas, fetchCustomers } from "@/lib/analytics/queries";
import { generateRecommendations } from "@/lib/analytics/recommendations";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Map — Hyderabad Sweets",
};

export default async function MapPage() {
  const [customers, branches, areas] = await Promise.all([
    fetchCustomers({ limit: 10000 }),
    fetchActiveBranches(),
    fetchAllAreas(),
  ]);

  const areaAgg = aggregateByArea(customers);
  const aggMap = new Map(areaAgg.map((a) => [a.area, a]));

  const areaPoints = areas
    .filter((a) => a.is_active)
    .map((a) => {
      const agg = aggMap.get(a.area_name);
      return {
        id: a.id,
        name: a.area_name,
        zone: a.zone_name,
        latitude: Number(a.latitude),
        longitude: Number(a.longitude),
        count: agg?.count ?? 0,
        avgDistanceKm: agg?.avgDistanceKm ?? null,
      };
    });

  const recs = generateRecommendations(customers, branches, areas, { topN: 3 });
  const recPoints = recs.map((r) => ({
    name: r.area,
    confidence: r.confidenceScore,
    latitude: r.centroid.latitude,
    longitude: r.centroid.longitude,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Map view</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OpenStreetMap base, branches in maroon, demand bubbles per area, and recommended
          expansion candidates highlighted in gold.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branches &amp; demand</CardTitle>
          <CardDescription>
            Bubble size scales with customer count. Click a bubble for details.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <CityMap
            branches={branches.map((b) => ({
              id: b.id,
              name: b.branch_name,
              area: b.main_area,
              address: b.address,
              latitude: Number(b.latitude),
              longitude: Number(b.longitude),
              isActive: b.is_active,
            }))}
            areaPoints={areaPoints}
            recommendations={recPoints}
          />
        </CardContent>
      </Card>
    </div>
  );
}
