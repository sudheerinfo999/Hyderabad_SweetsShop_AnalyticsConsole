import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaTable } from "@/components/master-data/area-table";
import { SubAreaTable } from "@/components/master-data/sub-area-table";
import { fetchAllAreas, fetchAllSubAreas } from "@/lib/analytics/queries";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Master data — Hyderabad Sweets",
};

export default async function MasterDataPage() {
  await requireAdmin();
  const [areas, subAreas] = await Promise.all([fetchAllAreas(), fetchAllSubAreas()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Master data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintain the Hyderabad / HMR areas and sub-areas that drive customer entry, distance, and
          recommendation analytics.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Areas &amp; sub-areas</CardTitle>
          <CardDescription>
            Customers can only be added against entries listed here, keeping the dataset clean.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="areas">
            <TabsList>
              <TabsTrigger value="areas">Areas ({areas.length})</TabsTrigger>
              <TabsTrigger value="sub">Sub-areas ({subAreas.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="areas">
              <AreaTable areas={areas} />
            </TabsContent>
            <TabsContent value="sub">
              <SubAreaTable areas={areas} subAreas={subAreas} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
