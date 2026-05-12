import {
  Bell,
  BookOpen,
  Calendar,
  ChartLine,
  ImageIcon,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Settings,
  ShieldCheck,
  Share2,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NavGate } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  gate?: NavGate;
  section: "core" | "studios" | "team" | "owner";
}

export const NAV_ITEMS: NavItem[] = [
  {
    section: "core",
    href: "/dashboard",
    label: "Command Center",
    description: "Home, alerts, recent activity",
    icon: LayoutDashboard,
  },
  {
    section: "core",
    href: "/atlas",
    label: "Atlas Chat",
    description: "Hermes-style AI assistant",
    icon: MessageCircle,
  },
  {
    section: "core",
    href: "/knowledge",
    label: "Source Knowledge",
    description: "Collections and retrieval",
    icon: BookOpen,
  },
  {
    section: "studios",
    href: "/social",
    label: "Social Studio",
    description: "Multi-channel drafts",
    icon: Share2,
  },
  {
    section: "studios",
    href: "/images",
    label: "Image Studio",
    description: "Fal.ai generation",
    icon: ImageIcon,
  },
  {
    section: "studios",
    href: "/email",
    label: "Email Studio",
    description: "Newsletters and campaigns",
    icon: Mail,
  },
  {
    section: "studios",
    href: "/calendar",
    label: "Calendar",
    description: "Content planning",
    icon: Calendar,
  },
  {
    section: "team",
    href: "/shared",
    label: "Shared Resources",
    description: "Owner-curated assets",
    icon: Sparkles,
  },
  {
    section: "owner",
    href: "/admin",
    label: "Admin Center",
    description: "Users, usage, audit logs",
    icon: ShieldCheck,
    gate: { ownerOnly: true },
  },
  {
    section: "owner",
    href: "/admin/usage",
    label: "Usage & Activity",
    description: "Team-wide rollups",
    icon: ChartLine,
    gate: { ownerOnly: true },
  },
  {
    section: "owner",
    href: "/admin/users",
    label: "Users & Roles",
    description: "Manage team access",
    icon: Users,
    gate: { ownerOnly: true },
  },
  {
    section: "team",
    href: "/settings",
    label: "Settings",
    description: "Profile and integrations",
    icon: Settings,
  },
];

export const NAV_SECTIONS: { key: NavItem["section"]; label: string }[] = [
  { key: "core", label: "Core" },
  { key: "studios", label: "Studios" },
  { key: "team", label: "Team" },
  { key: "owner", label: "Owner only" },
];

export { Bell };
