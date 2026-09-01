"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { History, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCustomerVisitAction,
  listCustomerVisitsAction,
  type CustomerVisitRow,
} from "@/app/(app)/customers/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatVisitedDaysBack } from "@/lib/utils";

interface Props {
  customerId: string;
  customerName: string;
  visitCount: number;
}

export function VisitHistoryButton({ customerId, customerName, visitCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState<CustomerVisitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCustomerVisitsAction(customerId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not load visits");
        setVisits([]);
        return;
      }
      setVisits(result.visits ?? []);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!open) return;
    void loadVisits();
  }, [open, loadVisits]);

  function onDeleteVisit(visit: CustomerVisitRow) {
    const when = format(new Date(visit.created_at), "d MMM yyyy, h:mm a");
    const isLast = visits.length <= 1;
    const ok = window.confirm(
      isLast
        ? `Delete the only visit on ${when}?\n\nThis will also delete the customer record for "${customerName}".`
        : `Delete visit on ${when}${
            visit.purchase_amount != null ? ` (₹${Number(visit.purchase_amount)})` : ""
          }?\n\nVisit count and lifetime amount will be recalculated.`,
    );
    if (!ok) return;

    setDeletingId(visit.id);
    startTransition(async () => {
      const result = await deleteCustomerVisitAction(visit.id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.message ?? "Could not delete visit");
        return;
      }
      toast.success(result.message ?? "Visit deleted");
      if (result.customerDeleted) {
        setOpen(false);
        router.refresh();
        return;
      }
      await loadVisits();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="View visit history"
      >
        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
          {visitCount}
          <History className="ml-1 h-3 w-3 opacity-70" />
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Visit history</DialogTitle>
            <DialogDescription>
              {customerName} — every counter entry. Delete a specific day/visit without removing
              other visits (unless it is the last one).
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading visits…
            </div>
          ) : visits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No visit rows found for this customer.
            </p>
          ) : (
            <div className="space-y-3">
              {visits.length !== visitCount && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  Listed visits ({visits.length}) differ from the stored visit count ({visitCount}).
                  Deleting or re-saving will resync totals from this list.
                </p>
              )}
            <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {visits.map((v, index) => {
                const ago = formatVisitedDaysBack(v.created_at);
                return (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">
                        {format(new Date(v.created_at), "d MMM yyyy")}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {format(new Date(v.created_at), "h:mm a")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ago ?? "—"}
                        {index === 0 ? " · latest" : ""}
                        {" · "}
                        Amount:{" "}
                        {formatCurrency(
                          v.purchase_amount != null ? Number(v.purchase_amount) : null,
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={isPending}
                      title="Delete this visit"
                      onClick={() => onDeleteVisit(v)}
                    >
                      {deletingId === v.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
