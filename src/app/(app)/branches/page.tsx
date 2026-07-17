import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BranchManager } from "@/components/branches/branch-manager";
import { fetchActiveBranches, fetchAllAreas } from "@/lib/analytics/queries";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Branches — Hyderabad Sweets",
};

export default async function BranchesPage() {
  await requireAdmin();
  const [branches, areas] = await Promise.all([fetchActiveBranches(), fetchAllAreas()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Branch management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add, edit, and toggle the shop branches that power distance and recommendation analytics.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Building2 className="h-4 w-4 text-brand-maroon" />
          <div>
            <CardTitle>Active &amp; inactive branches</CardTitle>
            <CardDescription>
              Customers are auto-assigned to the nearest active branch using the Haversine formula.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <BranchManager initialBranches={branches} areas={areas} />
        </CardContent>
      </Card>
    </div>
  );
}
