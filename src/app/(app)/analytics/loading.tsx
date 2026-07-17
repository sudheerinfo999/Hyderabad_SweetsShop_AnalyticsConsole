import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-96" />
      <Skeleton className="h-96" />
    </div>
  );
}
