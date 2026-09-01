import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatKm(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(2)} km`;
}

/** Calendar-day gap from an ISO timestamp to local today (0 = today). */
export function calendarDaysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffMs = startToday.getTime() - startThen.getTime();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));

  // Future clocks / TZ skew — treat as today rather than negative.
  if (days < 0) return 0;
  return days;
}

/**
 * Counter-friendly last-visit label.
 * - today → "visited today"
 * - 1 → "visited 1 day back"
 * - n → "visited n days back"
 */
export function formatVisitedDaysBack(
  iso: string | null | undefined,
  now = new Date(),
): string | null {
  const days = calendarDaysSince(iso, now);
  if (days == null) return null;
  if (days === 0) return "visited today";
  if (days === 1) return "visited 1 day back";
  return `visited ${days} days back`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
