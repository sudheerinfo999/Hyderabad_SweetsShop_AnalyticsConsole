"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { deleteSubAreaAction, upsertSubAreaAction } from "@/app/(app)/master-data/actions";
import type { HyderabadArea, HyderabadSubArea } from "@/lib/supabase/types";

type Draft = {
  id?: string;
  main_area_id: string;
  sub_area_name: string;
  latitude: string;
  longitude: string;
};

const emptyDraft: Draft = {
  main_area_id: "",
  sub_area_name: "",
  latitude: "",
  longitude: "",
};

export function SubAreaTable({
  areas,
  subAreas,
}: {
  areas: HyderabadArea[];
  subAreas: HyderabadSubArea[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  const filtered = useMemo(() => {
    return subAreas
      .filter((s) => !areaFilter || s.main_area_id === areaFilter)
      .filter((s) =>
        !filter.trim()
          ? true
          : s.sub_area_name.toLowerCase().includes(filter.trim().toLowerCase()),
      );
  }, [subAreas, filter, areaFilter]);

  function openCreate() {
    setDraft(emptyDraft);
    setErrors({});
    setOpen(true);
  }

  function openEdit(s: HyderabadSubArea) {
    setDraft({
      id: s.id,
      main_area_id: s.main_area_id,
      sub_area_name: s.sub_area_name,
      latitude: s.latitude == null ? "" : String(s.latitude),
      longitude: s.longitude == null ? "" : String(s.longitude),
    });
    setErrors({});
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const payload = {
        main_area_id: draft.main_area_id,
        sub_area_name: draft.sub_area_name,
        latitude: draft.latitude.trim() ? Number(draft.latitude) : null,
        longitude: draft.longitude.trim() ? Number(draft.longitude) : null,
      };
      const result = await upsertSubAreaAction(payload, draft.id);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save");
        setErrors(result.fieldErrors ?? {});
        return;
      }
      toast.success(draft.id ? "Sub-area updated" : "Sub-area added");
      setOpen(false);
      router.refresh();
    });
  }

  function remove(s: HyderabadSubArea) {
    if (!window.confirm(`Delete sub-area "${s.sub_area_name}"?`)) return;
    startTransition(async () => {
      const result = await deleteSubAreaAction(s.id);
      if (!result.ok) {
        toast.error(result.message ?? "Could not delete");
        return;
      }
      toast.success("Sub-area deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr,200px,auto]">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter sub-areas"
        />
        <Select value={areaFilter || "__all__"} onValueChange={(v) => setAreaFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="All areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All areas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.area_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} variant="maroon">
          <Plus className="h-4 w-4" /> Add sub-area
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sub-area</TableHead>
            <TableHead>Main area</TableHead>
            <TableHead>Coordinates</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                No sub-areas match.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.sub_area_name}</TableCell>
              <TableCell>{areaById.get(s.main_area_id)?.area_name ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {s.latitude != null && s.longitude != null
                  ? `${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}`
                  : "Inherits area centroid"}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(s)}
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
              <DialogTitle>{draft.id ? "Edit sub-area" : "Add sub-area"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Main area</Label>
                <Select
                  value={draft.main_area_id}
                  onValueChange={(v) => setDraft({ ...draft, main_area_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.area_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.main_area_id && <p className="text-xs text-destructive">{errors.main_area_id}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label>Sub-area name</Label>
                <Input
                  value={draft.sub_area_name}
                  onChange={(e) => setDraft({ ...draft, sub_area_name: e.target.value })}
                  required
                />
                {errors.sub_area_name && <p className="text-xs text-destructive">{errors.sub_area_name}</p>}
              </div>
              <div>
                <Label>Latitude (optional)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={draft.latitude}
                  onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
                />
              </div>
              <div>
                <Label>Longitude (optional)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={draft.longitude}
                  onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="maroon" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {draft.id ? "Save changes" : "Create sub-area"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
