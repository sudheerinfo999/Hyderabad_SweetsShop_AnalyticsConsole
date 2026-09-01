"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { areaInputSchema, subAreaInputSchema } from "@/lib/validation";

interface Result {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    out[issue.path.join(".") || "form"] = issue.message;
  }
  return out;
}

async function requireAdminClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false as const, message: "Admins only." };
  return { ok: true as const, supabase };
}

function revalidateMaster() {
  revalidateTag(CACHE_TAGS.masterData);
  revalidateTag(CACHE_TAGS.analytics);
  revalidatePath("/master-data");
  revalidatePath("/customers/new");
}

export async function upsertAreaAction(input: unknown, id?: string | null): Promise<Result> {
  const auth = await requireAdminClient();
  if (!auth.ok) return { ok: false, message: auth.message };

  const parsed = areaInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please review the form.", fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  if (id) {
    const { error } = await auth.supabase.from("hyderabad_areas").update(parsed.data).eq("id", id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await auth.supabase.from("hyderabad_areas").insert(parsed.data);
    if (error) return { ok: false, message: error.message };
  }
  revalidateMaster();
  return { ok: true };
}

export async function deleteAreaAction(id: string): Promise<Result> {
  const auth = await requireAdminClient();
  if (!auth.ok) return { ok: false, message: auth.message };
  const { error } = await auth.supabase.from("hyderabad_areas").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateMaster();
  return { ok: true };
}

export async function upsertSubAreaAction(input: unknown, id?: string | null): Promise<Result> {
  const auth = await requireAdminClient();
  if (!auth.ok) return { ok: false, message: auth.message };

  const parsed = subAreaInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please review the form.", fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  if (id) {
    const { error } = await auth.supabase.from("hyderabad_sub_areas").update(parsed.data).eq("id", id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await auth.supabase.from("hyderabad_sub_areas").insert(parsed.data);
    if (error) return { ok: false, message: error.message };
  }
  revalidateMaster();
  return { ok: true };
}

export async function deleteSubAreaAction(id: string): Promise<Result> {
  const auth = await requireAdminClient();
  if (!auth.ok) return { ok: false, message: auth.message };
  const { error } = await auth.supabase.from("hyderabad_sub_areas").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateMaster();
  return { ok: true };
}
