import { z } from "zod";
import { FAVOURITE_SWEETS } from "@/lib/sweets";

export const mobileRegex = /^(\+?91[-\s]?)?[6-9]\d{9}$/;

export const customerInputSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  mobile_number: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || mobileRegex.test(val.replace(/\s+/g, "")),
      "Enter a valid Indian mobile number",
    )
    .transform((v) => (v ? v.replace(/\s+/g, "") : v)),
  main_area: z.string().trim().min(1, "Main area is required"),
  sub_area: z.string().trim().optional().nullable(),
  purchase_amount: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : null;
    })
    .refine((v) => v == null || v >= 0, "Amount must be 0 or positive"),
  favourite_sweet: z
    .string()
    .trim()
    .min(1, "Please select a favourite sweet")
    .refine(
      (v) => (FAVOURITE_SWEETS as readonly string[]).includes(v),
      "Pick a sweet from the list",
    ),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const branchInputSchema = z.object({
  branch_name: z.string().trim().min(2, "Branch name is required").max(120),
  address: z.string().trim().min(5, "Address is required").max(500),
  main_area: z.string().trim().min(1, "Main area is required"),
  latitude: z.coerce
    .number()
    .min(16, "Latitude must be within HMR")
    .max(19, "Latitude must be within HMR"),
  longitude: z.coerce
    .number()
    .min(77, "Longitude must be within HMR")
    .max(80, "Longitude must be within HMR"),
  is_active: z.boolean().optional().default(true),
});

export type BranchInput = z.infer<typeof branchInputSchema>;

export const areaInputSchema = z.object({
  area_name: z.string().trim().min(2).max(100),
  zone_name: z.string().trim().min(2).max(80),
  latitude: z.coerce.number().min(16).max(19),
  longitude: z.coerce.number().min(77).max(80),
  is_active: z.boolean().optional().default(true),
});

export type AreaInput = z.infer<typeof areaInputSchema>;

/** Counter-friendly create: only name required; zone/coords get sensible defaults. */
export const customAreaQuickSchema = z.object({
  area_name: z.string().trim().min(2, "Area name is required").max(100),
  zone_name: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length >= 2 ? v : "Custom")),
  latitude: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 17.385044;
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : 17.385044;
    })
    .pipe(z.number().min(16, "Latitude must be within HMR").max(19, "Latitude must be within HMR")),
  longitude: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 78.486671;
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : 78.486671;
    })
    .pipe(z.number().min(77, "Longitude must be within HMR").max(80, "Longitude must be within HMR")),
});

export type CustomAreaQuickInput = z.infer<typeof customAreaQuickSchema>;

export const subAreaInputSchema = z.object({
  main_area_id: z.string().uuid(),
  sub_area_name: z.string().trim().min(2).max(120),
  latitude: z.coerce.number().min(16).max(19).optional().nullable(),
  longitude: z.coerce.number().min(77).max(80).optional().nullable(),
});

export type SubAreaInput = z.infer<typeof subAreaInputSchema>;

export const customSubAreaQuickSchema = z.object({
  main_area_id: z.string().uuid("Pick a main area first"),
  sub_area_name: z.string().trim().min(2, "Sub-area name is required").max(120),
});

export type CustomSubAreaQuickInput = z.infer<typeof customSubAreaQuickSchema>;
