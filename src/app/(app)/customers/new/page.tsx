import { CustomerForm } from "@/components/customers/customer-form";
import { fetchAllAreas, fetchAllSubAreas } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New customer — Hyderabad Sweets",
};

export default async function NewCustomerPage() {
  const [areas, subAreas] = await Promise.all([fetchAllAreas(), fetchAllSubAreas()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Add customer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Counter-friendly entry. Only Name &amp; Main Area are required.
        </p>
      </div>
      <CustomerForm areas={areas} subAreas={subAreas} />
    </div>
  );
}
