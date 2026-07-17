"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteAreaAction, upsertAreaAction } from "@/app/(app)/master-data/actions";
import type { HyderabadArea } from "@/lib/supabase/types";

type Draft = {
  id?: string;
  area_name: string;
  zone_name: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
};

const emptyDraft: Draft = {
  area_name: "",
  zone_name: "",
  latitude: "",
  longitude: "",
  is_active: true,
};

export function AreaTable({ areas }: { areas: HyderabadArea[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter(
      (a) =>
        a.area_name.toLowerCase().includes(q) || a.zone_name.toLowerCase().includes(q),
    );
  }, [areas, search]);

  function openCreate() {
    setDraft(emptyDraft);
    setErrors({});
    setOpen(true);
  }

  function openEdit(area: HyderabadArea) {
    setDraft({
      id: area.id,
      area_name: area.area_name,
      zone_name: area.zone_name,
      latitude: String(area.latitude),
      longitude: String(area.longitude),
      is_active: area.is_active,
    });
    setErrors({});
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await upsertAreaAction(
        {
          area_name: draft.area_name,
          zone_name: draft.zone_name,
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
      toast.success(draft.id ? "Area updated" : "Area added");
      setOpen(false);
      router.refresh();
    });
  }

  function remove(area: HyderabadArea) {
    if (!window.confirm(`Delete area "${area.area_name}"?`)) return;
    startTransition(async () => {
      const result = await deleteAreaAction(area.id);
      if (!result.ok) {
        toast.error(result.message ?? "Could not delete");
        return;
      }
      toast.success("Area deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search areas or zones"
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} variant="maroon">
          <Plus className="h-4 w-4" /> Add area
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Area</TableHead>
            <TableHead>Zone</TableHead>
            <TableHead>Coordinates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No areas found.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.area_name}</TableCell>
              <TableCell>{a.zone_name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}
              </TableCell>
              <TableCell>
                <Badge variant={a.is_active ? "success" : "outline"}>
                  {a.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(a)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit area" : "Add area"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Area name</Label>
                <Input
                  value={draft.area_name}
                  onChange={(e) => setDraft({ ...draft, area_name: e.target.value })}
                  required
                />
                {errors.area_name && <p className="text-xs text-destructive">{errors.area_name}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label>Zone</Label>
                <Input
                  value={draft.zone_name}
                  onChange={(e) => setDraft({ ...draft, zone_name: e.target.value })}
                  required
                />
                {errors.zone_name && <p className="text-xs text-destructive">{errors.zone_name}</p>}
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
              <div className="flex items-center gap-3 sm:col-span-2">
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
                {draft.id ? "Save changes" : "Create area"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
