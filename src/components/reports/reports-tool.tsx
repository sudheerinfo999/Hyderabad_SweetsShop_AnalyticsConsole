"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  aggregateByArea,
  aggregateByBranch,
  aggregateByDistanceBucket,
  aggregateBySubArea,
} from "@/lib/analytics/aggregations";
import { downloadCsv, downloadXlsx } from "@/lib/exports";
import { formatCurrency, formatKm } from "@/lib/utils";
import type { Customer, HyderabadArea, ShopBranch } from "@/lib/supabase/types";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range" },
] as const;
const ALL = "__all__";

export function ReportsTool({
  customers,
  branches,
  areas,
}: {
  customers: Customer[];
  branches: ShopBranch[];
  areas: HyderabadArea[];
}) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("30");
  const [from, setFrom] = useState(format(new Date(Date.now() - 30 * 24 * 3600 * 1000), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");

  const range = useMemo(() => computeRange(preset, from, to), [preset, from, to]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const t = new Date(c.created_at).getTime();
      if (range.start != null && t < range.start) return false;
      if (range.end != null && t > range.end) return false;
      if (areaFilter && c.main_area !== areaFilter) return false;
      if (branchFilter && c.nearest_branch_id !== branchFilter) return false;
      return true;
    });
  }, [customers, range, areaFilter, branchFilter]);

  const areaAgg = useMemo(() => aggregateByArea(filtered), [filtered]);
  const subAgg = useMemo(() => aggregateBySubArea(filtered), [filtered]);
  const distAgg = useMemo(() => aggregateByDistanceBucket(filtered), [filtered]);
  const branchAgg = useMemo(() => aggregateByBranch(filtered, branches), [filtered, branches]);

  function exportCsv() {
    const rows = filtered.map((c) => ({
      Name: c.customer_name,
      Mobile: c.mobile_number ?? "",
      "Main area": c.main_area,
      "Sub-area": c.sub_area ?? "",
      "Distance (km)": c.distance_km ?? "",
      "Purchase amount": c.purchase_amount ?? "",
      "Favourite sweet": c.favourite_sweet ?? "",
      "Created at": new Date(c.created_at).toISOString(),
    }));
    downloadCsv(`customers-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, rows);
  }

  function exportXlsx() {
    downloadXlsx(`hyderabad-sweets-report-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`, [
      {
        name: "Customers",
        rows: filtered.map((c) => ({
          Name: c.customer_name,
          Mobile: c.mobile_number ?? "",
          "Main area": c.main_area,
          "Sub-area": c.sub_area ?? "",
          "Distance (km)": c.distance_km ?? "",
          "Purchase amount": c.purchase_amount ?? "",
          "Favourite sweet": c.favourite_sweet ?? "",
          "Created at": new Date(c.created_at).toISOString(),
        })),
      },
      {
        name: "Areas",
        rows: areaAgg.map((a) => ({
          Area: a.area,
          Customers: a.count,
          "Share %": a.sharePct.toFixed(2),
          Revenue: a.revenue,
          "Avg distance (km)": a.avgDistanceKm ?? "",
          "Growth %": a.growthPct ?? "",
        })),
      },
      {
        name: "Sub-areas",
        rows: subAgg.map((s) => ({
          "Sub-area": s.subArea,
          "Main area": s.mainArea,
          Customers: s.count,
          "Share %": s.sharePct.toFixed(2),
          Revenue: s.revenue,
        })),
      },
      {
        name: "Distance",
        rows: distAgg.map((d) => ({
          Bucket: d.bucket,
          Customers: d.count,
          "Share %": d.sharePct.toFixed(2),
        })),
      },
      {
        name: "Branches",
        rows: branchAgg.map((b) => ({
          Branch: b.branchName,
          Customers: b.count,
          "Avg distance (km)": b.avgDistanceKm ?? "",
          Revenue: b.revenue,
        })),
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label>Period</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as typeof preset)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preset === "custom" && (
          <>
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <Label>Area</Label>
          <Select value={areaFilter || ALL} onValueChange={(v) => setAreaFilter(v === ALL ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All areas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All areas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.area_name}>
                  {a.area_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Branch</Label>
          <Select value={branchFilter || ALL} onValueChange={(v) => setBranchFilter(v === ALL ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.branch_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-4">
        <div className="text-sm">
          <p className="font-medium">{filtered.length.toLocaleString()} customers selected</p>
          <p className="text-xs text-muted-foreground">
            {range.label}
            {areaFilter ? ` · ${areaFilter}` : ""}
            {branchFilter
              ? ` · ${branches.find((b) => b.id === branchFilter)?.branch_name ?? "Branch"}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <FileText className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="gold" onClick={exportXlsx} disabled={filtered.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportTable
          title="By area"
          columns={["Area", "Customers", "Share %", "Revenue", "Avg km"]}
          rows={areaAgg.slice(0, 15).map((a) => [
            a.area,
            a.count.toLocaleString(),
            `${a.sharePct.toFixed(1)}%`,
            formatCurrency(a.revenue),
            a.avgDistanceKm == null ? "—" : formatKm(a.avgDistanceKm),
          ])}
        />
        <ReportTable
          title="By distance"
          columns={["Bucket", "Customers", "Share %"]}
          rows={distAgg.map((d) => [
            <Badge key={d.bucket} variant="outline">
              {d.bucket}
            </Badge>,
            d.count.toLocaleString(),
            `${d.sharePct.toFixed(1)}%`,
          ])}
        />
        <ReportTable
          title="Top sub-areas"
          columns={["Sub-area", "Main area", "Customers", "Revenue"]}
          rows={subAgg
            .slice(0, 15)
            .map((s) => [s.subArea, s.mainArea, s.count.toLocaleString(), formatCurrency(s.revenue)])}
        />
        <ReportTable
          title="By branch"
          columns={["Branch", "Customers", "Avg km", "Revenue"]}
          rows={branchAgg.map((b) => [
            b.branchName,
            b.count.toLocaleString(),
            b.avgDistanceKm == null ? "—" : formatKm(b.avgDistanceKm),
            formatCurrency(b.revenue),
          ])}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        <Download className="mr-1 inline h-3 w-3" /> PDF export coming soon — for now, CSV/Excel are
        rich enough for finance and operations workflows.
      </p>
    </div>
  );
}

function computeRange(
  preset: (typeof PRESETS)[number]["id"],
  from: string,
  to: string,
): { start: number | null; end: number | null; label: string } {
  const now = Date.now();
  switch (preset) {
    case "today": {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return { start: d.getTime(), end: now, label: "Today" };
    }
    case "7":
      return { start: now - 7 * 86400000, end: now, label: "Last 7 days" };
    case "30":
      return { start: now - 30 * 86400000, end: now, label: "Last 30 days" };
    case "90":
      return { start: now - 90 * 86400000, end: now, label: "Last 90 days" };
    case "all":
      return { start: null, end: null, label: "All time" };
    case "custom": {
      const start = from ? new Date(`${from}T00:00:00`).getTime() : null;
      const end = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
      return { start, end, label: `Custom (${from || "…"} → ${to || "…"})` };
    }
  }
}

function ReportTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <p className="font-display text-base font-semibold">{title}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                No data in range.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
