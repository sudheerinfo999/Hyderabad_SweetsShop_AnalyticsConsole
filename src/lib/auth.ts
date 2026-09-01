import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { homePathForRole } from "@/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/supabase/types";

async function profileFromHeaders(): Promise<Profile | null> {
  const h = await headers();
  const id = h.get("x-app-user-id");
  if (!id) return null;
  const role = h.get("x-app-role");
  const appRole: AppRole = role === "admin" ? "admin" : "staff";
  return {
    id,
    role: appRole,
    email: h.get("x-app-email") || null,
    full_name: h.get("x-app-name") || null,
    is_active: h.get("x-app-active") !== "false",
    created_at: "",
    updated_at: "",
  };
}

/** Deduped per request — middleware injects profile headers to skip extra DB round-trips. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const fromMiddleware = await profileFromHeaders();
  if (fromMiddleware) return fromMiddleware;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("getCurrentProfile error:", error.message);
    return null;
  }
  return data;
});

export const requireUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect(homePathForRole(profile.role));
  return profile;
}
