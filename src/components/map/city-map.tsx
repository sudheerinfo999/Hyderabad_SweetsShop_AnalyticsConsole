"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const InnerMap = dynamic(() => import("./city-map-inner").then((m) => m.CityMapInner), {
  ssr: false,
  loading: () => <Skeleton className="h-[540px] w-full rounded-none" />,
});

export interface BranchPoint {
  id: string;
  name: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface AreaPoint {
  id: string;
  name: string;
  zone: string;
  latitude: number;
  longitude: number;
  count: number;
  avgDistanceKm: number | null;
}

export interface RecPoint {
  name: string;
  confidence: number;
  latitude: number;
  longitude: number;
}

export function CityMap(props: {
  branches: BranchPoint[];
  areaPoints: AreaPoint[];
  recommendations: RecPoint[];
}) {
  return (
    <div className="h-[540px] w-full overflow-hidden rounded-b-xl">
      <InnerMap {...props} />
    </div>
  );
}
