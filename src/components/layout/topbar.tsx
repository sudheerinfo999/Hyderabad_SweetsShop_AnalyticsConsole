"use client";

import { LogOut, Moon, Plus, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export function Topbar({ profile }: { profile: Profile }) {
  const { theme, setTheme } = useTheme();
  const name = profile.full_name || profile.email || "User";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-2">
        <MobileNav role={profile.role} />
        <div className="hidden flex-col leading-tight sm:flex">
          <p className="font-display text-base font-semibold">Welcome, {name.split(" ")[0]}</p>
          <p className="text-xs text-muted-foreground">
            Hyderabad · Secunderabad · HMR · Internal Analytics
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="gold" size="sm" className="hidden sm:inline-flex">
          <Link href="/customers/new">
            <Plus className="h-4 w-4" />
            Add Customer
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                <AvatarFallback>{initials(name) || "HS"}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium normal-case">{name}</span>
                <span className="text-xs text-muted-foreground normal-case">{profile.email}</span>
                <Badge variant={profile.role === "admin" ? "maroon" : "gold"} className="mt-1 w-fit">
                  {profile.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserRound className="mr-2 h-4 w-4" /> Profile (soon)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post" className="w-full">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
