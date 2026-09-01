"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  customAreaQuickSchema,
  customSubAreaQuickSchema,
  customerInputSchema,
} from "@/lib/validation";
import { fetchAllAreas } from "@/lib/analytics/queries";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Customer, HyderabadArea, HyderabadSubArea } from "@/lib/supabase/types";

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
  area?: HyderabadArea;
  subArea?: HyderabadSubArea;
  /** True when an existing customer was updated (visit incremented). */
  returning?: boolean;
  visitCount?: number;
  customer?: CustomerMatch;
  customers?: CustomerMatch[];
}

export type CustomerMatch = Pick<
  Customer,
  | "id"
  | "customer_name"
  | "mobile_number"
  | "main_area"
  | "sub_area"
  | "favourite_sweet"
  | "review"
  | "visit_count"
  | "purchase_amount"
> & {
  /** Latest visit timestamp (customer_visits), else customer.created_at. */
  last_visited_at: string | null;
  created_at?: string;
};

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    out[issue.path.join(".") || "form"] = issue.message;
  }
  return out;
}

async function requireSignedInUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Not authenticated." };
  return { ok: true as const, user, supabase };
}

/** Normalise Indian mobiles to a 10-digit form for matching. */
function normaliseMobile(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits.length > 0 ? digits : null;
}

function buildFullAddress(mainArea: string, subArea: string | null | undefined) {
  return subArea ? `${subArea}, ${mainArea}, Hyderabad` : `${mainArea}, Hyderabad`;
}

function revalidateAfterCounterSave() {
  revalidateTag(CACHE_TAGS.customersList);
}

function revalidateAfterAdminDataChange() {
  revalidateTag(CACHE_TAGS.analytics);
  revalidateTag(CACHE_TAGS.customersList);
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/reports");
  revalidatePath("/recommendations");
}

const MATCH_SELECT =
  "id, customer_name, mobile_number, main_area, sub_area, favourite_sweet, review, visit_count, purchase_amount, created_at";

/**
 * Predictive search — single RPC round-trip (see migration 0005_performance.sql).
 */
export async function searchCustomersAction(input: {
  customer_name?: string;
  mobile_number?: string;
}): Promise<ActionResult> {
  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };

  const name = input.customer_name?.trim() ?? "";
  const digits = (input.mobile_number ?? "").replace(/\D/g, "");

  if (name.length < 2 && digits.length < 6) {
    return { ok: true, customers: [] };
  }

  const { data, error } = await auth.supabase.rpc("search_customers_counter", {
    p_name: name.length >= 2 ? name : null,
    p_mobile_digits: digits.length >= 6 ? digits : null,
    p_limit: 8,
  });

  if (error) {
    console.error("search_customers_counter RPC failed:", error.message);
    return { ok: false, message: "Search temporarily unavailable." };
  }

  return { ok: true, customers: (data ?? []) as CustomerMatch[] };
}

export async function createCustomerAction(input: unknown): Promise<ActionResult> {
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }

  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };
  const { user, supabase } = auth;

  // Area list is cached (5 min) — avoids a cold DB hit on every counter save.
  const areas = await fetchAllAreas();
  const areaRow = areas.find((a) => a.area_name === parsed.data.main_area);
  if (!areaRow || !areaRow.is_active) {
    return {
      ok: false,
      message: "Selected area is not in the Hyderabad / HMR master list.",
      fieldErrors: { main_area: "Pick an area from the dropdown" },
    };
  }

  const full_address = buildFullAddress(parsed.data.main_area, parsed.data.sub_area);
  const amount = parsed.data.purchase_amount ?? null;

  // Name/mobile matches are suggestions only. Treat as returning customer ONLY when
  // the counter staff explicitly selected an existing record (existing_customer_id).
  let existing: CustomerMatch | null = null;
  if (parsed.data.existing_customer_id) {
    const { data: byId } = await supabase
      .from("customers")
      .select(MATCH_SELECT)
      .eq("id", parsed.data.existing_customer_id)
      .maybeSingle();
    existing = (byId as CustomerMatch | null) ?? null;
    if (!existing) {
      return {
        ok: false,
        message: "Selected customer was not found. Clear and try again, or add as new.",
      };
    }
  }

  if (existing) {
    const nextVisitCount = Number(existing.visit_count ?? 1) + 1;
    const prevAmount = existing.purchase_amount != null ? Number(existing.purchase_amount) : 0;
    const nextAmount =
      amount != null ? prevAmount + amount : existing.purchase_amount != null ? prevAmount : null;

    const updatePayload: Record<string, unknown> = {
      visit_count: nextVisitCount,
      purchase_amount: nextAmount,
      main_area: parsed.data.main_area,
      sub_area: parsed.data.sub_area ?? null,
      full_address,
      favourite_sweet: parsed.data.favourite_sweet,
      is_estimated_location: true,
    };
    if (parsed.data.mobile_number) {
      updatePayload.mobile_number = parsed.data.mobile_number;
    }
    if (parsed.data.review) {
      updatePayload.review = parsed.data.review;
    }

    const { error: updateErr } = await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", existing.id);

    if (updateErr) return { ok: false, message: updateErr.message };

    const { error: visitErr } = await supabase.from("customer_visits").insert({
      customer_id: existing.id,
      purchase_amount: amount,
      created_by: user.id,
    });
    if (visitErr) return { ok: false, message: visitErr.message };

    revalidateAfterCounterSave();
    return {
      ok: true,
      id: existing.id,
      returning: true,
      visitCount: nextVisitCount,
      message: `Returning customer — visit #${nextVisitCount} recorded.`,
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      customer_name: parsed.data.customer_name,
      mobile_number: parsed.data.mobile_number ?? null,
      main_area: parsed.data.main_area,
      sub_area: parsed.data.sub_area ?? null,
      full_address,
      purchase_amount: amount,
      favourite_sweet: parsed.data.favourite_sweet,
      review: parsed.data.review ?? null,
      visit_count: 1,
      is_estimated_location: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  const { error: visitErr } = await supabase.from("customer_visits").insert({
    customer_id: data.id,
    purchase_amount: amount,
    created_by: user.id,
  });
  if (visitErr) return { ok: false, message: visitErr.message };

  revalidateAfterCounterSave();
  return { ok: true, id: data.id, returning: false, visitCount: 1 };
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false, message: "Only admins can delete customers." };
  }

  const { error } = await auth.supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateAfterAdminDataChange();
  return { ok: true };
}

export type CustomerVisitRow = {
  id: string;
  customer_id: string;
  purchase_amount: number | null;
  created_at: string;
};

/** Admin: list every visit for a customer (newest first). */
export async function listCustomerVisitsAction(
  customerId: string,
): Promise<ActionResult & { visits?: CustomerVisitRow[]; customerDeleted?: boolean }> {
  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false, message: "Only admins can view visit history." };
  }

  const { data, error } = await auth.supabase
    .from("customer_visits")
    .select("id, customer_id, purchase_amount, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, message: error.message };
  return { ok: true, visits: (data ?? []) as CustomerVisitRow[] };
}

/**
 * Admin: delete one visit and resync visit_count + lifetime purchase_amount.
 * If it was the last visit, the customer record is removed (visit_count must stay >= 1).
 */
export async function deleteCustomerVisitAction(
  visitId: string,
): Promise<
  ActionResult & {
    remainingVisits?: number;
    customerDeleted?: boolean;
  }
> {
  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false, message: "Only admins can delete visits." };
  }

  const { data: visit, error: visitLookupErr } = await auth.supabase
    .from("customer_visits")
    .select("id, customer_id, purchase_amount, created_at")
    .eq("id", visitId)
    .maybeSingle();

  if (visitLookupErr) return { ok: false, message: visitLookupErr.message };
  if (!visit) return { ok: false, message: "Visit not found (already deleted?)." };

  const customerId = visit.customer_id as string;

  const { error: deleteErr } = await auth.supabase
    .from("customer_visits")
    .delete()
    .eq("id", visitId);
  if (deleteErr) return { ok: false, message: deleteErr.message };

  const { data: remaining, error: remErr } = await auth.supabase
    .from("customer_visits")
    .select("id, purchase_amount")
    .eq("customer_id", customerId);

  if (remErr) return { ok: false, message: remErr.message };

  const left = remaining ?? [];
  if (left.length === 0) {
    const { error: custDelErr } = await auth.supabase
      .from("customers")
      .delete()
      .eq("id", customerId);
    if (custDelErr) return { ok: false, message: custDelErr.message };

    revalidateAfterAdminDataChange();
    return {
      ok: true,
      remainingVisits: 0,
      customerDeleted: true,
      message: "Last visit removed — customer record deleted.",
    };
  }

  const totalAmount = left.reduce((sum, row) => {
    const n = row.purchase_amount != null ? Number(row.purchase_amount) : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const { error: syncErr } = await auth.supabase
    .from("customers")
    .update({
      visit_count: left.length,
      purchase_amount: totalAmount > 0 ? totalAmount : null,
    })
    .eq("id", customerId);

  if (syncErr) return { ok: false, message: syncErr.message };

  revalidateAfterAdminDataChange();
  return {
    ok: true,
    remainingVisits: left.length,
    customerDeleted: false,
    message: `Visit deleted. ${left.length} visit${left.length === 1 ? "" : "s"} remaining.`,
  };
}

/**
 * Counter staff can add a missing area on the fly.
 * Uses the service-role client because area writes are admin-only in RLS.
 */
export async function createCustomAreaAction(input: unknown): Promise<ActionResult> {
  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };

  const parsed = customAreaQuickSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const admin = createSupabaseAdminClient();
  const areaName = parsed.data.area_name;

  const { data: existing } = await admin
    .from("hyderabad_areas")
    .select("*")
    .ilike("area_name", areaName)
    .maybeSingle();

  if (existing) {
    if (!existing.is_active) {
      const { data: reactivated, error } = await admin
        .from("hyderabad_areas")
        .update({ is_active: true })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return { ok: false, message: error.message };
      revalidateAfterAreaChange();
      return { ok: true, area: reactivated as HyderabadArea, id: reactivated.id };
    }
    return {
      ok: true,
      message: "Area already exists — selected it for you.",
      area: existing as HyderabadArea,
      id: existing.id,
    };
  }

  const { data, error } = await admin
    .from("hyderabad_areas")
    .insert({
      area_name: areaName,
      zone_name: parsed.data.zone_name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidateAfterAreaChange();
  return { ok: true, area: data as HyderabadArea, id: data.id };
}

export async function createCustomSubAreaAction(input: unknown): Promise<ActionResult> {
  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };

  const parsed = customSubAreaQuickSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const admin = createSupabaseAdminClient();

  const { data: parent } = await admin
    .from("hyderabad_areas")
    .select("id, latitude, longitude, is_active")
    .eq("id", parsed.data.main_area_id)
    .maybeSingle();

  if (!parent || !parent.is_active) {
    return {
      ok: false,
      message: "Pick a valid main area first.",
      fieldErrors: { main_area_id: "Main area not found" },
    };
  }

  const { data: existing } = await admin
    .from("hyderabad_sub_areas")
    .select("*")
    .eq("main_area_id", parsed.data.main_area_id)
    .ilike("sub_area_name", parsed.data.sub_area_name)
    .maybeSingle();

  if (existing) {
    if (!existing.is_active) {
      const { data: reactivated, error } = await admin
        .from("hyderabad_sub_areas")
        .update({ is_active: true })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return { ok: false, message: error.message };
      revalidateAfterAreaChange();
      return { ok: true, subArea: reactivated as HyderabadSubArea, id: reactivated.id };
    }
    return {
      ok: true,
      message: "Sub-area already exists — selected it for you.",
      subArea: existing as HyderabadSubArea,
      id: existing.id,
    };
  }

  const { data, error } = await admin
    .from("hyderabad_sub_areas")
    .insert({
      main_area_id: parsed.data.main_area_id,
      sub_area_name: parsed.data.sub_area_name,
      latitude: parent.latitude,
      longitude: parent.longitude,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidateAfterAreaChange();
  return { ok: true, subArea: data as HyderabadSubArea, id: data.id };
}

function revalidateAfterAreaChange() {
  revalidateTag(CACHE_TAGS.masterData);
  revalidatePath("/customers/new");
  revalidatePath("/master-data");
}
