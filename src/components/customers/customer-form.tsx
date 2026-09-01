"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Gift,
  IndianRupee,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCustomAreaAction,
  createCustomSubAreaAction,
  createCustomerAction,
  searchCustomersAction,
  type CustomerMatch,
} from "@/app/(app)/customers/actions";
import { FAVOURITE_SWEET_PROMPT, FAVOURITE_SWEETS } from "@/lib/sweets";
import type { AppRole, HyderabadArea, HyderabadSubArea } from "@/lib/supabase/types";

interface Props {
  areas: HyderabadArea[];
  subAreas: HyderabadSubArea[];
  role?: AppRole;
}

const NONE_SUB = "__none__";

export function CustomerForm({ areas, subAreas, role = "staff" }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAreaPending, startAreaTransition] = useTransition();
  const [isSubPending, startSubTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [localAreas, setLocalAreas] = useState(areas);
  const [localSubAreas, setLocalSubAreas] = useState(subAreas);

  useEffect(() => {
    setLocalAreas(areas);
  }, [areas]);

  useEffect(() => {
    setLocalSubAreas(subAreas);
  }, [subAreas]);

  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [subAreaName, setSubAreaName] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [favouriteSweet, setFavouriteSweet] = useState<string | null>(null);
  const [review, setReview] = useState("");
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);
  const [lastVisitCount, setLastVisitCount] = useState<number | null>(null);
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerMatch | null>(null);
  /** User chose to create a separate record despite name suggestions. */
  const [forceNewCustomer, setForceNewCustomer] = useState(false);
  const [suggestions, setSuggestions] = useState<CustomerMatch[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeField, setActiveField] = useState<"name" | "mobile" | null>(null);
  const searchSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After Clear, ignore timers/in-flight searches until the user types again. */
  const suppressSearchRef = useRef(false);
  const nameWrapRef = useRef<HTMLDivElement>(null);
  const mobileWrapRef = useRef<HTMLDivElement>(null);

  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [customAreaName, setCustomAreaName] = useState("");
  const [customZoneName, setCustomZoneName] = useState("");
  const [areaDialogErrors, setAreaDialogErrors] = useState<Record<string, string>>({});

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [customSubName, setCustomSubName] = useState("");
  const [subDialogErrors, setSubDialogErrors] = useState<Record<string, string>>({});

  const selectedArea = useMemo(
    () => localAreas.find((a) => a.id === areaId) ?? null,
    [localAreas, areaId],
  );
  const subAreasForSelected = useMemo(
    () => (selectedArea ? localSubAreas.filter((s) => s.main_area_id === selectedArea.id) : []),
    [localSubAreas, selectedArea],
  );

  function cancelPendingSearch() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    searchSeq.current += 1;
  }

  const applyMatch = useCallback(
    (match: CustomerMatch) => {
      cancelPendingSearch();
      suppressSearchRef.current = true;
      setForceNewCustomer(false);
      setMatchedCustomer(match);
      setCustomerName(match.customer_name);
      setMobile(match.mobile_number ?? "");
      const area = localAreas.find(
        (a) => a.area_name.toLowerCase() === match.main_area.toLowerCase(),
      );
      setAreaId(area?.id ?? null);
      setSubAreaName(match.sub_area ?? null);
      if (match.favourite_sweet) setFavouriteSweet(match.favourite_sweet);
      setReview(match.review ?? "");
      setAmount("");
      setSuggestions([]);
      setSuggestOpen(false);
      setActiveField(null);
    },
    [localAreas],
  );

  /** Same name can be a different person — keep name, start a fresh record. */
  function addAsNewCustomer() {
    cancelPendingSearch();
    suppressSearchRef.current = true;
    const keptName = customerName.trim();
    setForceNewCustomer(true);
    setMatchedCustomer(null);
    setCustomerName(keptName);
    setMobile("");
    setAreaId(null);
    setSubAreaName(null);
    setFavouriteSweet(null);
    setReview("");
    setAmount("");
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveField(null);
  }

  /** Clear a wrong selection — must not snap back from a pending/in-flight search. */
  function clearSelection() {
    cancelPendingSearch();
    suppressSearchRef.current = true;
    setForceNewCustomer(false);
    setMatchedCustomer(null);
    setCustomerName("");
    setMobile("");
    setAreaId(null);
    setSubAreaName(null);
    setFavouriteSweet(null);
    setReview("");
    setAmount("");
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveField(null);
  }

  const runSearch = useCallback((opts: { name?: string; phone?: string; field: "name" | "mobile" }) => {
    if (suppressSearchRef.current) return;

    const trimmedName = (opts.name ?? "").trim();
    const digits = (opts.phone ?? "").replace(/\D/g, "");
    const shouldSearchName = opts.field === "name" && trimmedName.length >= 2;
    const shouldSearchMobile = opts.field === "mobile" && digits.length >= 6;

    if (!shouldSearchName && !shouldSearchMobile) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }

    const seq = ++searchSeq.current;
    startSearchTransition(async () => {
      const result = await searchCustomersAction({
        customer_name: shouldSearchName ? trimmedName : undefined,
        mobile_number: shouldSearchMobile ? digits : undefined,
      });
      // Drop stale responses (Clear / newer keystroke / selection).
      if (suppressSearchRef.current || seq !== searchSeq.current) return;
      if (!result.ok) return;
      const list = result.customers ?? [];
      setSuggestions(list);
      setSuggestOpen(list.length > 0);
      setActiveField(opts.field);
    });
  }, []);

  const scheduleSearch = useCallback(
    (opts: { name?: string; phone?: string; field: "name" | "mobile" }) => {
      if (suppressSearchRef.current) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => runSearch(opts), 280);
    },
    [runSearch],
  );

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (nameWrapRef.current?.contains(target) || mobileWrapRef.current?.contains(target)) {
        return;
      }
      setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function resetForm() {
    clearSelection();
  }

  function handleNameChange(value: string) {
    suppressSearchRef.current = false;
    setCustomerName(value);
    if (matchedCustomer && value !== matchedCustomer.customer_name) {
      setMatchedCustomer(null);
    }
    if (value.trim().length < 2) {
      cancelPendingSearch();
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    scheduleSearch({ name: value, field: "name" });
  }

  function handleMobileChange(value: string) {
    suppressSearchRef.current = false;
    setMobile(value);
    if (matchedCustomer) {
      const matchedDigits = (matchedCustomer.mobile_number ?? "").replace(/\D/g, "");
      const typedDigits = value.replace(/\D/g, "");
      if (
        matchedDigits &&
        typedDigits !== matchedDigits &&
        !matchedDigits.startsWith(typedDigits) &&
        typedDigits !== matchedDigits.slice(-typedDigits.length)
      ) {
        setMatchedCustomer(null);
      }
    }
    const digits = value.replace(/\D/g, "");
    if (digits.length < 6) {
      cancelPendingSearch();
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    scheduleSearch({ phone: value, field: "mobile" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!selectedArea) {
      setErrors({ main_area: "Pick an area" });
      return;
    }
    if (!favouriteSweet) {
      setErrors({ favourite_sweet: "Please select a favourite sweet" });
      return;
    }
    const payload = {
      customer_name: customerName,
      mobile_number: mobile.trim() ? mobile.trim() : undefined,
      main_area: selectedArea.area_name,
      sub_area: subAreaName && subAreaName !== NONE_SUB ? subAreaName : null,
      purchase_amount: amount.trim() ? Number(amount) : null,
      favourite_sweet: favouriteSweet,
      review: review.trim() ? review.trim() : undefined,
      // Only bind to an existing row when the user explicitly selected one.
      existing_customer_id: matchedCustomer && !forceNewCustomer ? matchedCustomer.id : null,
    };
    startTransition(async () => {
      const result = await createCustomerAction(payload);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save customer");
        setErrors(result.fieldErrors ?? {});
        return;
      }
      setLastSavedName(customerName);
      setLastVisitCount(result.visitCount ?? null);
      if (result.returning) {
        toast.success(
          `${customerName} — visit #${result.visitCount} recorded (existing customer).`,
        );
      } else {
        toast.success(`${customerName} saved as a new customer!`);
      }
      resetForm();
      router.refresh();
    });
  }

  function submitCustomArea(e: React.FormEvent) {
    e.preventDefault();
    setAreaDialogErrors({});
    startAreaTransition(async () => {
      const result = await createCustomAreaAction({
        area_name: customAreaName,
        zone_name: customZoneName.trim() || undefined,
      });
      if (!result.ok || !result.area) {
        toast.error(result.message ?? "Could not add area");
        setAreaDialogErrors(result.fieldErrors ?? {});
        return;
      }
      setLocalAreas((prev) => {
        if (prev.some((a) => a.id === result.area!.id)) return prev;
        return [...prev, result.area!].sort((a, b) =>
          a.area_name.localeCompare(b.area_name),
        );
      });
      setAreaId(result.area.id);
      setSubAreaName(null);
      setAreaDialogOpen(false);
      setCustomAreaName("");
      setCustomZoneName("");
      toast.success(result.message ?? `"${result.area.area_name}" added and selected`);
      router.refresh();
    });
  }

  function submitCustomSubArea(e: React.FormEvent) {
    e.preventDefault();
    setSubDialogErrors({});
    if (!selectedArea) {
      setSubDialogErrors({ main_area_id: "Pick a main area first" });
      return;
    }
    startSubTransition(async () => {
      const result = await createCustomSubAreaAction({
        main_area_id: selectedArea.id,
        sub_area_name: customSubName,
      });
      if (!result.ok || !result.subArea) {
        toast.error(result.message ?? "Could not add sub-area");
        setSubDialogErrors(result.fieldErrors ?? {});
        return;
      }
      setLocalSubAreas((prev) => {
        if (prev.some((s) => s.id === result.subArea!.id)) return prev;
        return [...prev, result.subArea!];
      });
      setSubAreaName(result.subArea.sub_area_name);
      setSubDialogOpen(false);
      setCustomSubName("");
      toast.success(result.message ?? `"${result.subArea.sub_area_name}" added and selected`);
      router.refresh();
    });
  }

  const isAdmin = role === "admin";

  function formatSuggestionMeta(s: CustomerMatch) {
    const mobileLabel = s.mobile_number?.trim() ? s.mobile_number : "Not Available";
    const areaLabel = s.sub_area ? `${s.main_area} · ${s.sub_area}` : s.main_area;
    return `${mobileLabel} · ${areaLabel} · ${s.visit_count} visit${s.visit_count === 1 ? "" : "s"}`;
  }

  function SuggestionList({ field }: { field: "name" | "mobile" }) {
    if (!suggestOpen || activeField !== field || suggestions.length === 0) return null;
    return (
      <ul
        className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        role="listbox"
      >
        <li className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Matching customers (select if same person)
        </li>
        {suggestions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="flex w-full flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyMatch(s)}
            >
              <span className="font-medium">{s.customer_name}</span>
              <span className="text-xs text-muted-foreground">{formatSuggestionMeta(s)}</span>
            </button>
          </li>
        ))}
        <li className="mt-1 border-t pt-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addAsNewCustomer}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add as New Customer
          </button>
          <p className="px-3 pb-2 text-[11px] text-muted-foreground">
            Same name can be a different person — creates a separate record.
          </p>
        </li>
      </ul>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            {matchedCustomer
              ? "Returning customer"
              : forceNewCustomer
                ? "New customer (same name OK)"
                : "New customer"}
          </CardTitle>
          <CardDescription>
            Name matches are suggestions only. Select an existing person to record a visit, or
            choose <span className="font-medium text-foreground">Add as New Customer</span> when
            it is someone else with the same name. Mobile is optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {matchedCustomer && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-800 dark:text-emerald-200">
                <UserCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    Selected existing customer — details pre-filled
                  </p>
                  <p className="text-xs">
                    {matchedCustomer.customer_name}
                    {matchedCustomer.mobile_number ? ` · ${matchedCustomer.mobile_number}` : " · No mobile"}
                    {" · "}
                    {matchedCustomer.main_area}
                    {matchedCustomer.sub_area ? `, ${matchedCustomer.sub_area}` : ""}
                    {" · "}
                    {matchedCustomer.visit_count} prior visit
                    {matchedCustomer.visit_count === 1 ? "" : "s"} — saving will record visit #
                    {matchedCustomer.visit_count + 1}.
                  </p>
                  <p className="text-[11px] opacity-80">
                    Enter today&apos;s purchase amount below; it will be added to today&apos;s
                    revenue.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            )}

            {forceNewCustomer && !matchedCustomer && (
              <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Plus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">Adding as a new customer</p>
                  <p className="text-xs text-muted-foreground">
                    Name &quot;{customerName || "…"}&quot; may already exist for someone else. This
                    save will create a <span className="font-medium text-foreground">separate</span>{" "}
                    record — existing customers with the same name will not be changed.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setForceNewCustomer(false)}
                >
                  <X className="h-4 w-4" />
                  Undo
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2" ref={nameWrapRef}>
                <Label htmlFor="name">
                  Customer name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    autoFocus
                    autoComplete="off"
                    required
                    value={customerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0 && activeField === "name") setSuggestOpen(true);
                    }}
                    placeholder="e.g. Sai Reddy — suggestions are optional"
                    className="pl-9"
                  />
                  {isSearching && activeField === "name" && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                  <SuggestionList field="name" />
                </div>
                {errors.customer_name && (
                  <p className="text-xs text-destructive">{errors.customer_name}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Matching names are suggestions only. Select existing, or use Add as New Customer
                  if it is a different person.
                </p>
              </div>

              <div className="space-y-2" ref={mobileWrapRef}>
                <Label htmlFor="mobile">Mobile number <b>(optional)</b></Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    value={mobile}
                    onChange={(e) => handleMobileChange(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0 && activeField === "mobile") setSuggestOpen(true);
                    }}
                    placeholder="Optional — suggestions after 6 digits"
                    className="pl-9"
                    maxLength={14}
                  />
                  {isSearching && activeField === "mobile" && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                  <SuggestionList field="mobile" />
                </div>
                {errors.mobile_number && (
                  <p className="text-xs text-destructive">{errors.mobile_number}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Optional. Never required to create a new customer.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  {matchedCustomer ? "Today's purchase amount (optional)" : "Purchase amount (optional)"}
                </Label>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 350"
                    className="pl-9"
                  />
                </div>
                {errors.purchase_amount && (
                  <p className="text-xs text-destructive">{errors.purchase_amount}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    Main area <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={() => {
                      setAreaDialogErrors({});
                      setCustomAreaName("");
                      setCustomZoneName("");
                      setAreaDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add custom area
                  </Button>
                </div>
                <Select
                  value={areaId ?? ""}
                  onValueChange={(value) => {
                    setAreaId(value);
                    setSubAreaName(null);
                  }}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select an area in HMR" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {localAreas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-medium">{a.area_name}</span>{" "}
                        <span className="text-xs text-muted-foreground">· {a.zone_name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.main_area && (
                  <p className="text-xs text-destructive">{errors.main_area}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Sub-area / colony (optional)</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    disabled={!selectedArea}
                    onClick={() => {
                      setSubDialogErrors({});
                      setCustomSubName("");
                      setSubDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add custom sub-area
                  </Button>
                </div>
                <Select
                  value={subAreaName ?? ""}
                  onValueChange={(v) => setSubAreaName(v)}
                  disabled={!selectedArea}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedArea
                          ? "Pick a main area first"
                          : subAreasForSelected.length === 0
                            ? "Optional — or add a custom sub-area"
                            : "Optional"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SUB}>— None —</SelectItem>
                    {subAreasForSelected.map((s) => (
                      <SelectItem key={s.id} value={s.sub_area_name}>
                        {s.sub_area_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border-2 border-secondary/60 bg-gradient-to-br from-secondary/25 via-accent/40 to-brand-cream/80 p-4 shadow-sm ring-1 ring-secondary/30 dark:from-secondary/20 dark:via-accent/20 dark:to-card">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Gift className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                    Grab Your Gift
                  </p>
                  <Label htmlFor="favourite-sweet" className="text-base font-semibold leading-snug text-foreground">
                    {FAVOURITE_SWEET_PROMPT}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                </div>
              </div>
              <Select
                value={favouriteSweet ?? ""}
                onValueChange={(value) => {
                  setFavouriteSweet(value);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.favourite_sweet;
                    return next;
                  });
                }}
              >
                <SelectTrigger
                  id="favourite-sweet"
                  className="h-11 border-secondary/70 bg-background/90 font-medium shadow-sm focus:ring-secondary"
                >
                  <SelectValue placeholder="Choose a favourite sweet…" />
                </SelectTrigger>
                <SelectContent>
                  {FAVOURITE_SWEETS.map((sweet) => (
                    <SelectItem key={sweet} value={sweet}>
                      {sweet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.favourite_sweet && (
                <p className="text-xs text-destructive">{errors.favourite_sweet}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="review">Customer review (optional)</Label>
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="review"
                  autoComplete="off"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="e.g. Loved the gulab jamun, will visit again…"
                  className="min-h-[88px] resize-y pl-9"
                  maxLength={1000}
                />
              </div>
              {errors.review && (
                <p className="text-xs text-destructive">{errors.review}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Quick feedback from the customer — saved with their entry for later reference.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Location:</span>
                <Badge variant="outline">Area-based (estimated)</Badge>
                <span>— nearest branch &amp; travel distance are calculated automatically.</span>
              </div>
              <div className="flex gap-2">
                {isAdmin ? (
                  <Button asChild type="button" variant="ghost">
                    <Link href="/customers">Cancel</Link>
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    <RefreshCw className="h-4 w-4" />
                    Clear
                  </Button>
                )}
                <Button type="submit" variant="maroon" size="lg" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : matchedCustomer ? (
                    <UserCheck className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {matchedCustomer ? "Record visit" : "Save customer"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Counter tips</CardTitle>
          <CardDescription>How to make this fast</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="font-medium">Same name ≠ same person</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Suggestions are a reference only. Pick an existing row to record a visit, or{" "}
              <span className="font-medium text-foreground">Add as New Customer</span> when it is
              someone else — even with the identical name.
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="font-medium">Keyboard-first</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tab through the fields, type the area name to filter the dropdown, hit Enter to save.
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="font-medium">Missing area?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use <span className="font-medium text-foreground">Add custom area</span> (or
              sub-area) if the locality is not in the list. It is saved to master data for
              everyone and selected automatically.
            </p>
          </div>

          {lastSavedName && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
              <p className="text-sm font-medium">Saved: {lastSavedName}</p>
              <p className="mt-1 text-xs">
                {lastVisitCount && lastVisitCount > 1
                  ? `Visit #${lastVisitCount} recorded. Form reset for the next customer.`
                  : "Form reset and ready for the next customer."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add custom area</DialogTitle>
            <DialogDescription>
              Use this when the customer&apos;s locality is not in the dropdown. It will be added
              to master data and selected for this entry.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCustomArea} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-area-name">
                Area name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-area-name"
                autoFocus
                autoComplete="off"
                required
                value={customAreaName}
                onChange={(e) => setCustomAreaName(e.target.value)}
                placeholder="e.g. Manikonda"
              />
              {areaDialogErrors.area_name && (
                <p className="text-xs text-destructive">{areaDialogErrors.area_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-zone-name">Zone (optional)</Label>
              <Input
                id="custom-zone-name"
                autoComplete="off"
                value={customZoneName}
                onChange={(e) => setCustomZoneName(e.target.value)}
                placeholder='Defaults to "Custom"'
              />
              {areaDialogErrors.zone_name && (
                <p className="text-xs text-destructive">{areaDialogErrors.zone_name}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Map coordinates default to Hyderabad centre. Admins can refine them later under
                Master Data.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAreaDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="maroon" disabled={isAreaPending}>
                {isAreaPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add &amp; select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add custom sub-area</DialogTitle>
            <DialogDescription>
              Adds a colony / locality under{" "}
              <span className="font-medium text-foreground">
                {selectedArea?.area_name ?? "the selected area"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCustomSubArea} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-sub-name">
                Sub-area / colony name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-sub-name"
                autoFocus
                autoComplete="off"
                required
                value={customSubName}
                onChange={(e) => setCustomSubName(e.target.value)}
                placeholder="e.g. Puppalaguda"
              />
              {(subDialogErrors.sub_area_name || subDialogErrors.main_area_id) && (
                <p className="text-xs text-destructive">
                  {subDialogErrors.sub_area_name ?? subDialogErrors.main_area_id}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSubDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="maroon" disabled={isSubPending || !selectedArea}>
                {isSubPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add &amp; select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
