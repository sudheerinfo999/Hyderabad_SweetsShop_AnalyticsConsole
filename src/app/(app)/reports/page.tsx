import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsTool } from "@/components/reports/reports-tool";
import { fetchActiveBranches, fetchAllAreas, fetchAnalyticsCustomers } from "@/lib/analytics/queries";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports — Hyderabad Sweets",
};

export default async function ReportsPage() {
  await requireAdmin();
  const [customers, branches, areas] = await Promise.all([
    fetchAnalyticsCustomers(8000),
    fetchActiveBranches(),
    fetchAllAreas(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a period, slice by area or branch, and export to CSV or Excel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Build a report</CardTitle>
          <CardDescription>
            All processing happens in-browser, so exports are instant — no large server downloads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportsTool customers={customers} branches={branches} areas={areas} />
        </CardContent>
      </Card>
    </div>
  );
}
