"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleNavSections } from "@/lib/navigation";
import type { AppRole } from "@/lib/supabase/types";

export function Sidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const sections = visibleNavSections(role);

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-card/70 backdrop-blur lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg brand-gradient text-brand-cream shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-foreground">Hyderabad Sweets</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Analytics Console
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                        active && "bg-accent text-foreground shadow-sm",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground",
                          active && "text-brand-maroon dark:text-brand-gold",
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/60 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Internal use only</p>
        <p>Hyderabad · Secunderabad · HMR</p>
      </div>
    </aside>
  );
}
