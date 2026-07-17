import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number | null;
  helper?: string;
  accent?: "default" | "maroon" | "gold";
}

export function KpiCard({ label, value, icon: Icon, trend, helper, accent = "default" }: KpiCardProps) {
  const accentClasses: Record<NonNullable<KpiCardProps["accent"]>, string> = {
    default: "bg-muted text-foreground",
    maroon: "bg-brand-maroon/10 text-brand-maroon dark:text-brand-goldLight",
    gold: "bg-brand-gold/20 text-brand-maroonDark dark:text-brand-goldLight",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("grid h-12 w-12 place-items-center rounded-xl", accentClasses[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-display text-2xl font-semibold leading-none">{value}</p>
            {trend != null && Number.isFinite(trend) && (
              <span
                className={cn(
                  "inline-flex items-center text-xs font-medium",
                  trend >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {trend >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          {helper && <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
