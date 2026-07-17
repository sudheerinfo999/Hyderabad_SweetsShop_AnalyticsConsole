import {
  BarChart3,
  Building2,
  LayoutDashboard,
  Lightbulb,
  Map as MapIcon,
  MapPinned,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { AppRole } from "@/lib/supabase/types";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  roles?: AppRole[];
};

export const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "KPIs and trends at a glance" },
      { href: "/customers", label: "Customers", icon: Users, description: "Browse and search entries" },
      { href: "/customers/new", label: "Add Customer", icon: UserPlus, description: "Fast counter entry" },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, description: "Areas, sub-areas, distance, growth" },
      { href: "/map", label: "Map View", icon: MapIcon, description: "Branches & area demand" },
      { href: "/recommendations", label: "Recommendations", icon: Sparkles, description: "Where to open next" },
      { href: "/insights", label: "AI Insights", icon: Lightbulb, description: "Auto-generated takeaways" },
      { href: "/reports", label: "Reports", icon: BarChart3, description: "Export & period reports" },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/branches",
        label: "Branches",
        icon: Building2,
        description: "Manage shop branches",
        roles: ["admin"],
      },
      {
        href: "/master-data",
        label: "Master Data",
        icon: MapPinned,
        description: "Areas & sub-areas",
        roles: ["admin"],
      },
    ],
  },
];

export function visibleNavSections(role: AppRole) {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}
