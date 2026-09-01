import { Skeleton } from "@/components/ui/skeleton";

export default function NewCustomerLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[640px] lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
