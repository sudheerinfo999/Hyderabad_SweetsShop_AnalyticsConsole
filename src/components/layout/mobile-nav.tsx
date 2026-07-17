"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { visibleNavSections } from "@/lib/navigation";
import type { AppRole } from "@/lib/supabase/types";

export function MobileNav({ role }: { role: AppRole }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sections = visibleNavSections(role);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-xl">
            <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
              <div className="grid h-9 w-9 place-items-center rounded-lg brand-gradient text-brand-cream">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <p className="font-display text-sm font-semibold">Hyderabad Sweets</p>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Analytics
                </p>
              </div>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
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
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                              active && "bg-accent text-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
