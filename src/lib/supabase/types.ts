// Lightweight typed wrappers for Supabase rows. We don't auto-generate types here
// (the project is bring-your-own-Supabase) — we keep these in sync with the SQL migration.

export type AppRole = "admin" | "staff";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HyderabadArea {
  id: string;
  area_name: string;
  zone_name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
}

export interface HyderabadSubArea {
  id: string;
  main_area_id: string;
  sub_area_name: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
}

export interface ShopBranch {
  id: string;
  branch_name: string;
  address: string;
  main_area: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_name: string;
  mobile_number: string | null;
  main_area: string;
  sub_area: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  purchase_amount: number | null;
  favourite_sweet: string | null;
  nearest_branch_id: string | null;
  distance_km: number | null;
  is_estimated_location: boolean;
  created_at: string;
  created_by: string | null;
}

export interface CustomerWithBranch extends Customer {
  shop_branches?: Pick<ShopBranch, "id" | "branch_name"> | null;
}
