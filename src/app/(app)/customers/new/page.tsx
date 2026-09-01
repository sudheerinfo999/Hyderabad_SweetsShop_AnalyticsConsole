import { CustomerForm } from "@/components/customers/customer-form";
import { fetchAllAreas, fetchAllSubAreas } from "@/lib/analytics/queries";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New customer — Hyderabad Sweets",
};

export default async function NewCustomerPage() {
  const [profile, areas, subAreas] = await Promise.all([
    requireProfile(),
    fetchAllAreas(),
    fetchAllSubAreas(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Add customer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Counter-friendly entry. Matching name or mobile records another visit on the existing
          customer.
        </p>
      </div>
      <CustomerForm areas={areas} subAreas={subAreas} role={profile.role} />
    </div>
  );
}
