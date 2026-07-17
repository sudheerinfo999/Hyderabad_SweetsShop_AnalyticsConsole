"use server";

import { revalidatePath } from "next/cache";
import {
  customAreaQuickSchema,
  customSubAreaQuickSchema,
  customerInputSchema,
} from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { HyderabadArea, HyderabadSubArea } from "@/lib/supabase/types";

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
  area?: HyderabadArea;
  subArea?: HyderabadSubArea;
}

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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

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

  const full_address = parsed.data.sub_area
    ? `${parsed.data.sub_area}, ${parsed.data.main_area}, Hyderabad`
    : `${parsed.data.main_area}, Hyderabad`;

  const { data, error } = await supabase
    .from("customers")
    .insert({
      customer_name: parsed.data.customer_name,
      mobile_number: parsed.data.mobile_number ?? null,
      main_area: parsed.data.main_area,
      sub_area: parsed.data.sub_area ?? null,
      full_address,
      purchase_amount: parsed.data.purchase_amount ?? null,
      favourite_sweet: parsed.data.favourite_sweet,
      is_estimated_location: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/reports");
  revalidatePath("/recommendations");

  return { ok: true, id: data.id };
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
