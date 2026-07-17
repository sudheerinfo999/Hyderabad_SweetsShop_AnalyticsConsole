"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { branchInputSchema } from "@/lib/validation";

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

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, message: "Admins only." } as const;
  }
  return { ok: true, supabase } as const;
}

export async function upsertBranchAction(
  input: unknown,
  id?: string | null,
): Promise<Result> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const parsed = branchInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const payload = parsed.data;
  if (id) {
    const { error } = await auth.supabase
      .from("shop_branches")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await auth.supabase.from("shop_branches").insert(payload);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/branches");
  revalidatePath("/dashboard");
  revalidatePath("/map");
  revalidatePath("/recommendations");
  return { ok: true };
}

export async function deleteBranchAction(id: string): Promise<Result> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const { error } = await auth.supabase.from("shop_branches").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/branches");
  revalidatePath("/dashboard");
  revalidatePath("/map");
  return { ok: true };
}

export async function toggleBranchActiveAction(id: string, isActive: boolean): Promise<Result> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const { error } = await auth.supabase
    .from("shop_branches")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/branches");
  return { ok: true };
}
