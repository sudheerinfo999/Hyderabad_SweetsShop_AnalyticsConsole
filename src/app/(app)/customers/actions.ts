"use server";

import { revalidatePath } from "next/cache";
import {
  customAreaQuickSchema,
  customSubAreaQuickSchema,
  customerInputSchema,
} from "@/lib/validation";
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
>;

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

function revalidateCustomerPaths() {
  revalidatePath("/customers");
  revalidatePath("/customers/new");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/reports");
  revalidatePath("/recommendations");
}

const MATCH_SELECT =
  "id, customer_name, mobile_number, main_area, sub_area, favourite_sweet, review, visit_count, purchase_amount";

/**
 * Find an existing customer by mobile (preferred) or exact name (case-insensitive).
 */
async function findExistingCustomer(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  opts: { customer_name?: string; mobile_number?: string | null },
): Promise<CustomerMatch | null> {
  const mobile = normaliseMobile(opts.mobile_number ?? null);

  if (mobile) {
    const variants = [
      mobile,
      `+91${mobile}`,
      `91${mobile}`,
      `+91-${mobile}`,
      `+91 ${mobile}`,
    ];
    const { data: byMobile } = await supabase
      .from("customers")
      .select(MATCH_SELECT)
      .or(variants.map((v) => `mobile_number.eq.${v}`).join(","))
      .order("created_at", { ascending: true })
      .limit(10);

    const hit =
      (byMobile ?? []).find((row) => normaliseMobile(row.mobile_number) === mobile) ?? null;
    if (hit) return hit as CustomerMatch;

    // Fallback: scan recent rows whose stored number normalises to the same 10 digits
    // (covers odd formatting not covered by the exact variants above).
    const { data: recent } = await supabase
      .from("customers")
      .select(MATCH_SELECT)
      .not("mobile_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    const soft = (recent ?? []).find((row) => normaliseMobile(row.mobile_number) === mobile);
    if (soft) return soft as CustomerMatch;
  }

  const name = opts.customer_name?.trim();
  if (name && name.length >= 2) {
    const { data: byName } = await supabase
      .from("customers")
      .select(MATCH_SELECT)
      .ilike("customer_name", name)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byName) return byName as CustomerMatch;
  }

  return null;
}

/** Counter lookup used to pre-fill the form when name or mobile matches. */
export async function lookupCustomerAction(input: {
  customer_name?: string;
  mobile_number?: string;
}): Promise<ActionResult> {
  const auth = await requireSignedInUser();
  if (!auth.ok) return { ok: false, message: auth.message };

  const name = input.customer_name?.trim() ?? "";
  const mobile = input.mobile_number?.trim() ?? "";
  if (name.length < 2 && !mobile) {
    return { ok: true, customer: undefined };
  }

  const match = await findExistingCustomer(auth.supabase, {
    customer_name: name.length >= 2 ? name : undefined,
    mobile_number: mobile || null,
  });

  return { ok: true, customer: match ?? undefined };
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

  // Verify the area is in our HMR master list (server-side validation).
  const { data: areaRow, error: areaErr } = await supabase
    .from("hyderabad_areas")
    .select("area_name, is_active")
    .eq("area_name", parsed.data.main_area)
    .maybeSingle();

  if (areaErr) return { ok: false, message: areaErr.message };
  if (!areaRow || !areaRow.is_active) {
    return {
      ok: false,
      message: "Selected area is not in the Hyderabad / HMR master list.",
      fieldErrors: { main_area: "Pick an area from the dropdown" },
    };
  }

  const full_address = buildFullAddress(parsed.data.main_area, parsed.data.sub_area);
  const amount = parsed.data.purchase_amount ?? null;

  const existing = await findExistingCustomer(supabase, {
    customer_name: parsed.data.customer_name,
    mobile_number: parsed.data.mobile_number ?? null,
  });

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

    revalidateCustomerPaths();
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

  revalidateCustomerPaths();
  return { ok: true, id: data.id, returning: false, visitCount: 1 };
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  return { ok: true };
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
  revalidatePath("/customers");
  revalidatePath("/customers/new");
  revalidatePath("/master-data");
  revalidatePath("/dashboard");
  revalidatePath("/recommendations");
  revalidatePath("/analytics");
  revalidatePath("/branches");
}
