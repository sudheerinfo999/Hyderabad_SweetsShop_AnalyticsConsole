"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { deleteBranchAction, toggleBranchActiveAction, upsertBranchAction } from "@/app/(app)/branches/actions";
import type { HyderabadArea, ShopBranch } from "@/lib/supabase/types";

type Draft = {
  id?: string;
  branch_name: string;
  address: string;
  main_area: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
};

const emptyDraft: Draft = {
  branch_name: "",
  address: "",
  main_area: "",
  latitude: "",
  longitude: "",
  is_active: true,
};

export function BranchManager({
  initialBranches,
  areas,
}: {
  initialBranches: ShopBranch[];
  areas: HyderabadArea[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const areaByName = useMemo(() => new Map(areas.map((a) => [a.area_name, a])), [areas]);

  function openCreate() {
    setDraft(emptyDraft);
    setErrors({});
    setOpen(true);
  }

  function openEdit(branch: ShopBranch) {
    setDraft({
      id: branch.id,
      branch_name: branch.branch_name,
      address: branch.address,
      main_area: branch.main_area,
      latitude: String(branch.latitude),
      longitude: String(branch.longitude),
      is_active: branch.is_active,
    });
    setErrors({});
    setOpen(true);
  }

  function handleAreaSelect(name: string) {
    const area = areaByName.get(name);
    setDraft((d) => ({
      ...d,
      main_area: name,
      latitude: area ? String(area.latitude) : d.latitude,
      longitude: area ? String(area.longitude) : d.longitude,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await upsertBranchAction(
        {
          branch_name: draft.branch_name,
          address: draft.address,
          main_area: draft.main_area,
          latitude: Number(draft.latitude),
          longitude: Number(draft.longitude),
          is_active: draft.is_active,
        },
        draft.id,
      );
      if (!result.ok) {
        toast.error(result.message ?? "Could not save");
        setErrors(result.fieldErrors ?? {});
        return;
      }
      toast.success(draft.id ? "Branch updated" : "Branch created");
      setOpen(false);
      router.refresh();
    });
  }

  function handleToggle(branch: ShopBranch) {
    startTransition(async () => {
      const result = await toggleBranchActiveAction(branch.id, !branch.is_active);
      if (!result.ok) {
        toast.error(result.message ?? "Could not toggle status");
        return;
      }
      toast.success(branch.is_active ? "Branch deactivated" : "Branch activated");
      router.refresh();
    });
  }

  function handleDelete(branch: ShopBranch) {
    if (!window.confirm(`Delete "${branch.branch_name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteBranchAction(branch.id);
      if (!result.ok) {
        toast.error(result.message ?? "Could not delete");
        return;
      }
      toast.success("Branch deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} variant="maroon">
          <Plus className="h-4 w-4" /> New branch
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Branch</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Coordinates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialBranches.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No branches yet — add your first shop to power distance analytics.
              </TableCell>
            </TableRow>
          )}
          {initialBranches.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                <div className="font-medium">{b.branch_name}</div>
                <div className="text-xs text-muted-foreground">{b.address}</div>
              </TableCell>
              <TableCell>{b.main_area}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {Number(b.latitude).toFixed(4)}, {Number(b.longitude).toFixed(4)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={b.is_active}
                    onCheckedChange={() => handleToggle(b)}
                    disabled={isPending}
                  />
                  <Badge variant={b.is_active ? "success" : "outline"}>
                    {b.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)} disabled={isPending}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(b)}
                    disabled={isPending}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit branch" : "Add branch"}</DialogTitle>
              <DialogDescription>
                Coordinates auto-fill when you pick a master area, but you can fine-tune them.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label>Branch name</Label>
              <Input
                value={draft.branch_name}
                onChange={(e) => setDraft({ ...draft, branch_name: e.target.value })}
                placeholder="Hyderabad Sweets — Kondapur"
                required
              />
              {errors.branch_name && <p className="text-xs text-destructive">{errors.branch_name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                placeholder="Shop No. ..., Hyderabad"
                required
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label>Main area</Label>
                <Select value={draft.main_area} onValueChange={handleAreaSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.area_name}>
                        {a.area_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.main_area && <p className="text-xs text-destructive">{errors.main_area}</p>}
              </div>

              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={draft.latitude}
                  onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
                  required
                />
                {errors.latitude && <p className="text-xs text-destructive">{errors.latitude}</p>}
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={draft.longitude}
                  onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
                  required
                />
                {errors.longitude && <p className="text-xs text-destructive">{errors.longitude}</p>}
              </div>
              <div className="flex items-center gap-3 sm:col-span-1">
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
                <span className="text-sm">Active</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="maroon" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {draft.id ? "Save changes" : "Create branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
