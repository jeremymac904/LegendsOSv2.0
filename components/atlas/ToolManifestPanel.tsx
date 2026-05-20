"use client";

import {
  BookOpen,
  Calculator,
  Calendar as CalendarIcon,
  HelpCircle,
  Info,
  Mail,
  Scale,
  Share2,
  User,
  Workflow,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ToolEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

// Static manifest — mirror the Atlas tool router catalog. Kept inline per spec
// (no shared data source) since this surface is purely informational.
const TOOLS: ToolEntry[] = [
  {
    id: "create_social",
    label: "Social draft",
    icon: Share2,
    description:
      "Draft Facebook / Instagram / LinkedIn posts in Jeremy's voice with hashtags + CTA.",
  },
  {
    id: "create_email",
    label: "Email draft",
    icon: Mail,
    description:
      "Compose newsletters / drip emails grounded in your knowledge collections.",
  },
  {
    id: "create_calendar",
    label: "Calendar item",
    icon: CalendarIcon,
    description:
      "Schedule one-off events or recurring touchpoints on your Atlas calendar.",
  },
  {
    id: "create_knowledge_note",
    label: "Knowledge note",
    icon: BookOpen,
    description:
      "Persist a fact / playbook / lesson into your knowledge base for future grounding.",
  },
  {
    id: "trigger_automation",
    label: "Trigger automation",
    icon: Workflow,
    description:
      "Fire an n8n workflow (e.g. drip start, lead routing). Configure under Connectors.",
  },
  {
    id: "explain_capabilities",
    label: "Capabilities",
    icon: Info,
    description:
      "Tell me what you (Atlas) can do right now, including provider readiness.",
  },
  {
    id: "mortgage_calc",
    label: "Mortgage calc",
    icon: Calculator,
    description:
      "Compute monthly payment + total interest for a principal / rate / term.",
  },
  {
    id: "loan_comparison",
    label: "Loan comparison",
    icon: Scale,
    description:
      "Compare conventional, FHA, VA, jumbo, etc. side-by-side at a given principal.",
  },
  {
    id: "lead_summary",
    label: "Lead summary",
    icon: User,
    description:
      "Pull a borrower's status, stage, next step, last activity into a card.",
  },
];

export function ToolManifestPanel() {
  return (
    <section
      aria-label="Atlas tool manifest"
      className="card overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <Wrench size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Tools
            </p>
            <p className="text-[10px] text-ink-400">What Atlas can do in chat</p>
          </div>
        </div>
        <span className="chip h-5 px-1.5 text-[9px]">{TOOLS.length}</span>
      </header>

      <ul className="max-h-[280px] divide-y divide-ink-800/40 overflow-y-auto scrollbar-thin">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <li
              key={t.id}
              className="group flex items-start gap-2 px-3 py-2 transition hover:bg-ink-800/30"
            >
              <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink-700/70 bg-ink-900/60 text-ink-300 group-hover:text-accent-gold">
                <Icon size={11} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-medium text-ink-100">
                  {t.label}
                </p>
              </div>
              <button
                type="button"
                aria-label={`${t.label} description`}
                title={t.description}
                className="shrink-0 text-ink-500 transition hover:text-accent-gold"
              >
                <HelpCircle size={11} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
