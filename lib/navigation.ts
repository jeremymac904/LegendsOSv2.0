import {
  BookOpen,
  Briefcase,
  Calendar,
  ClipboardList,
  Compass,
  Factory,
  FileStack,
  FolderTree,
  GraduationCap,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Plug,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { NavGate } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  gate?: NavGate;
  section: "core" | "mortgage" | "studios" | "team" | "owner";
}

export const NAV_ITEMS: NavItem[] = [
  // ── Core ──────────────────────────────────────────────────────────
  {
    section: "core",
    href: "/chief-of-staff",
    label: "Chief of Staff",
    description: "What matters today — your daily AI briefing",
    icon: Compass,
  },
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
    label: "Knowledge Sources",
    description: "Collections and retrieval",
    icon: BookOpen,
  },

  // ── Mortgage (role-gated) ─────────────────────────────────────────
  {
    section: "mortgage",
    href: "/loan-brain",
    label: "Loan Brain",
    description: "Read-only Drive borrower file browser",
    icon: FolderTree,
    gate: { ownerOnly: true },
  },
  {
    section: "mortgage",
    href: "/flo-processing",
    label: "Flo Processing",
    description: "Ashley's processor cockpit with FLO assistant",
    icon: ClipboardList,
    gate: { roles: ["processor"] },
  },
  {
    section: "mortgage",
    href: "/coordinator",
    label: "Coordinator",
    description: "Geraldine's follow-up board",
    icon: UserCheck,
    gate: { roles: ["coordinator"] },
  },
  {
    section: "mortgage",
    href: "/my-loans",
    label: "My Loans",
    description: "Your assigned loan files",
    icon: Briefcase,
    gate: { roles: ["loan_officer"] },
  },

  // ── Studios ───────────────────────────────────────────────────────
  {
    section: "studios",
    href: "/social",
    label: "Social Studio",
    description: "Multi-channel drafts",
    icon: Share2,
  },
  {
    section: "studios",
    href: "/marketing-assistant",
    label: "Marketing Assistant",
    description: "Real marketing AI — social, email, GBP, YouTube, compliance",
    icon: Sparkles,
    gate: { roles: ["marketing"] },
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
    gate: { roles: ["marketing"] },
  },
  {
    section: "studios",
    href: "/calendar",
    label: "Calendar",
    description: "Content planning",
    icon: Calendar,
  },

  // ── Team ──────────────────────────────────────────────────────────
  {
    section: "team",
    href: "/training",
    label: "Training",
    description: "Academy, coaching, AI training, and resources",
    icon: GraduationCap,
  },
  {
    section: "team",
    href: "/marketing-materials",
    label: "Marketing Materials",
    description: "Templates and campaign assets",
    icon: FileStack,
  },
  {
    section: "team",
    href: "/lf-resources",
    label: "LF Resources",
    description: "Loan Factory links and guides",
    icon: Factory,
    gate: { roles: ["processor", "coordinator", "marketing"] },
  },
  {
    section: "team",
    href: "/settings",
    label: "Settings",
    description: "Profile, integrations, memory, and skills",
    icon: Settings,
  },

  // ── Owner ─────────────────────────────────────────────────────────
  {
    section: "owner",
    href: "/admin",
    label: "Admin",
    description: "Users, connections, usage, assets, security, and agent oversight",
    icon: ShieldCheck,
    gate: { ownerOnly: true },
  },
  {
    section: "owner",
    href: "/admin/connections",
    label: "Connection Center",
    description: "Google, Meta, Zapier MCP, n8n, and provider readiness",
    icon: Plug,
    gate: { adminOrOwner: true },
  },
  {
    section: "owner",
    href: "/builder",
    label: "Builder",
    description: "Jeremy's build cockpit — projects, capture, plans, QA",
    icon: Wrench,
    gate: { ownerOnly: true },
  },
  {
    section: "owner",
    href: "/email-intake",
    label: "Email Intake",
    description: "Gmail AI intake — review queue, attachments, routing",
    icon: Inbox,
    gate: { adminOrOwner: true },
  },
];

export const NAV_SECTIONS: { key: NavItem["section"]; label: string }[] = [
  { key: "core", label: "Core" },
  { key: "mortgage", label: "Mortgage" },
  { key: "studios", label: "Studios" },
  { key: "team", label: "Team" },
  { key: "owner", label: "Owner only" },
];
