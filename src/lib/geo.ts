// Geo helpers. All distances in km. Single source of truth for client + server.

export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;

export function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Number((EARTH_RADIUS_KM * c).toFixed(3));
}

/** Find nearest record from a list with lat/lng. Returns null if none. */
export function findNearest<T extends LatLng & { id: string }>(
  point: LatLng,
  candidates: T[],
): { item: T; distanceKm: number } | null {
  if (!candidates.length) return null;
  let bestItem: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = haversineKm(point, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      bestItem = candidate;
    }
  }
  if (!bestItem) return null;
  return { item: bestItem, distanceKm: bestDistance };
}

/** Bucket a distance value into reporting bands. */
export function distanceBucket(distanceKm: number | null | undefined): string {
  if (distanceKm == null) return "Unknown";
  if (distanceKm <= 2) return "0–2 km";
  if (distanceKm <= 5) return "2–5 km";
  if (distanceKm <= 10) return "5–10 km";
  return "10+ km";
}

export const DISTANCE_BUCKETS = ["0–2 km", "2–5 km", "5–10 km", "10+ km"] as const;
