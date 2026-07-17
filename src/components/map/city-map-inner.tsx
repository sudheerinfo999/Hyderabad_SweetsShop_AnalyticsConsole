"use client";

import { useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { AreaPoint, BranchPoint, RecPoint } from "./city-map";

// Make sure the default marker icons resolve (Next bundles assets oddly).
const branchIcon = L.divIcon({
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  html: `<div style="
    width:26px;height:26px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    background:#7B1E1E;border:2px solid #FAF3E7;box-shadow:0 4px 12px rgba(0,0,0,.25);
    display:grid;place-items:center;color:#FAF3E7;font-size:12px;font-weight:600;
  "><span style="transform:rotate(45deg)">★</span></div>`,
});

const inactiveBranchIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  html: `<div style="
    width:22px;height:22px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    background:#9ca3af;border:2px solid #FAF3E7;
    display:grid;place-items:center;color:#fff;font-size:10px;
  "><span style="transform:rotate(45deg)">·</span></div>`,
});

const recIcon = L.divIcon({
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  html: `<div style="
    width:30px;height:30px;border-radius:50%;
    background:radial-gradient(circle at 30% 30%, #E7C079, #D4A24C);
    border:3px solid #7B1E1E;box-shadow:0 4px 16px rgba(123,30,30,.35);
    display:grid;place-items:center;color:#7B1E1E;font-size:14px;font-weight:700;
  ">★</div>`,
});

const HMR_CENTER: [number, number] = [17.4399, 78.4983];

function radiusFor(count: number, maxCount: number) {
  if (count === 0) return 6;
  const min = 8;
  const max = 28;
  const r = Math.sqrt(count) / Math.sqrt(Math.max(1, maxCount));
  return Math.round(min + (max - min) * r);
}

export function CityMapInner({
  branches,
  areaPoints,
  recommendations,
}: {
  branches: BranchPoint[];
  areaPoints: AreaPoint[];
  recommendations: RecPoint[];
}) {
  const maxCount = useMemo(
    () => Math.max(1, ...areaPoints.map((a) => a.count)),
    [areaPoints],
  );
  const recAreas = useMemo(
    () => new Set(recommendations.map((r) => r.name)),
    [recommendations],
  );

  return (
    <MapContainer
      center={HMR_CENTER}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {areaPoints.map((a) => {
        const isRec = recAreas.has(a.name);
        const fillColor = a.count === 0 ? "#9CA3AF" : isRec ? "#D4A24C" : "#7B1E1E";
        return (
          <CircleMarker
            key={a.id}
            center={[a.latitude, a.longitude]}
            radius={radiusFor(a.count, maxCount)}
            pathOptions={{
              color: isRec ? "#7B1E1E" : "#5B1414",
              weight: isRec ? 2 : 1,
              fillColor,
              fillOpacity: a.count === 0 ? 0.2 : 0.55,
            }}
          >
            <Popup>
              <div className="space-y-1 text-xs">
                <p className="font-display text-sm font-semibold">{a.name}</p>
                <p className="text-muted-foreground">{a.zone}</p>
                <p>
                  <strong>{a.count}</strong> customers
                </p>
                {a.avgDistanceKm != null && (
                  <p>
                    Avg travel: <strong>{a.avgDistanceKm.toFixed(2)} km</strong>
                  </p>
                )}
                {isRec && (
                  <p className="rounded bg-brand-gold/20 px-2 py-1 font-medium text-brand-maroonDark">
                    Recommended for expansion
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {branches.map((b) => (
        <Marker
          key={b.id}
          position={[b.latitude, b.longitude]}
          icon={b.isActive ? branchIcon : inactiveBranchIcon}
        >
          <Popup>
            <div className="space-y-1 text-xs">
              <p className="font-display text-sm font-semibold">{b.name}</p>
              <p className="text-muted-foreground">{b.area}</p>
              <p>{b.address}</p>
              {!b.isActive && <p className="text-amber-600">Inactive</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {recommendations.map((r, idx) => (
        <Marker key={`${r.name}-${idx}`} position={[r.latitude, r.longitude]} icon={recIcon}>
          <Popup>
            <div className="space-y-1 text-xs">
              <p className="font-display text-sm font-semibold">
                #{idx + 1} {r.name}
              </p>
              <p>
                Confidence: <strong>{r.confidence.toFixed(0)}/100</strong>
              </p>
              <p className="text-muted-foreground">Recommended for new branch.</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
