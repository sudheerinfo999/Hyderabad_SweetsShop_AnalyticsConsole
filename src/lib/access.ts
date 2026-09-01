import type { AppRole } from "@/lib/supabase/types";

/** Default landing page after sign-in. */
export function homePathForRole(role: AppRole) {
  return role === "admin" ? "/dashboard" : "/customers/new";
}

/** Paths a normal (staff) user may open. Admins may open everything. */
export function staffCanAccessPath(pathname: string) {
  return pathname === "/customers/new" || pathname.startsWith("/customers/new/");
}

export function canAccessPath(role: AppRole, pathname: string) {
  if (role === "admin") return true;
  return staffCanAccessPath(pathname);
}
