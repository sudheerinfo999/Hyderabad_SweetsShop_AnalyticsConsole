import Link from "next/link";
import { Filter, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerRowActions } from "@/components/customers/row-actions";
import { fetchActiveBranches, fetchAllAreas } from "@/lib/analytics/queries";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCurrency, formatKm } from "@/lib/utils";
import type { CustomerWithBranch } from "@/lib/supabase/types";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface SearchParams {
  q?: string;
  area?: string;
  branch?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const [areas, branches] = await Promise.all([fetchAllAreas(), fetchActiveBranches()]);

  const page = Math.max(1, Number(params.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("customers")
    .select("*, shop_branches:nearest_branch_id (id, branch_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q?.trim()) {
    const q = params.q.trim();
    query = query.or(`customer_name.ilike.%${q}%,mobile_number.ilike.%${q}%`);
  }
  if (params.area) query = query.eq("main_area", params.area);
  if (params.branch) query = query.eq("nearest_branch_id", params.branch);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59.999Z`);

  const { data, count, error } = await query;
  if (error) {
    return <ErrorState message={error.message} />;
  }

  const rows = (data ?? []) as CustomerWithBranch[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canDelete = profile.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount.toLocaleString()} entries · search, filter, and review
          </p>
        </div>
        <Button asChild variant="maroon">
          <Link href="/customers/new">
            <Plus className="h-4 w-4" />
            New customer
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
          <CardDescription>Combine any of the filters below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
            <div className="lg:col-span-2">
              <Input name="q" placeholder="Name or mobile" defaultValue={params.q ?? ""} />
            </div>
            <select
              name="area"
              defaultValue={params.area ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.area_name}>
                  {a.area_name}
                </option>
              ))}
            </select>
            <select
              name="branch"
              defaultValue={params.branch ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
            <Input type="date" name="from" defaultValue={params.from ?? ""} />
            <Input type="date" name="to" defaultValue={params.to ?? ""} />
            <div className="col-span-full flex items-center justify-between gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/customers">Reset</Link>
              </Button>
              <Button type="submit" variant="default" size="sm">
                Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="grid place-items-center py-16 text-center text-sm text-muted-foreground">
              No customers match these filters.{" "}
              <Link href="/customers/new" className="ml-1 inline-flex items-center gap-1 text-foreground underline">
                Add the first customer
              </Link>
              .
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Favourite sweet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.customer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.mobile_number ? c.mobile_number : "No mobile"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{c.main_area}</div>
                      <div className="text-xs text-muted-foreground">{c.sub_area ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      {c.shop_branches?.branch_name ?? (
                        <Badge variant="outline">unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatKm(c.distance_km != null ? Number(c.distance_km) : null)}</TableCell>
                    <TableCell>{formatCurrency(c.purchase_amount != null ? Number(c.purchase_amount) : null)}</TableCell>
                    <TableCell>
                      {c.favourite_sweet ? (
                        <span className="text-sm">{c.favourite_sweet}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">{format(new Date(c.created_at), "d MMM yyyy")}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(c.created_at), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canDelete ? (
                        <CustomerRowActions id={c.id} name={c.customer_name} />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={buildPageHref(params, page - 1)}>Previous</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
              <Link href={buildPageHref(params, page + 1)}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildPageHref(params: SearchParams, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "page") sp.set(k, String(v));
  }
  sp.set("page", String(page));
  return `/customers?${sp.toString()}`;
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-destructive">{message}</CardContent>
    </Card>
  );
}
