import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
