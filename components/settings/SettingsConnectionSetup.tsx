"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CalendarDays,
  ExternalLink,
  KeyRound,
  Mail,
  PlugZap,
  Video,
} from "lucide-react";

import { SETUP_COACH_URL } from "@/components/help/LegendsOSHelpCoaches";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";

export interface ConnectionSetupGuide {
  id: string;
  title: string;
  detail: string;
  envNames: string[];
  configured: boolean;
  icon: "plug" | "video" | "google" | "bot" | "mail" | "key";
  scope: "Owner" | "Team" | "Personal";
  href?: string;
  buttonLabel?: string;
  steps: string[];
  ownerAction?: string;
  teamAction?: string;
  videoPlaceholder: string;
}

interface Props {
  guides: ConnectionSetupGuide[];
}

const ICONS = {
  plug: PlugZap,
  video: Video,
  google: CalendarDays,
  bot: Bot,
  mail: Mail,
  key: KeyRound,
};

export function SettingsConnectionSetup({ guides }: Props) {
  const [selectedId, setSelectedId] = useState(guides[0]?.id ?? "");
  const selected = useMemo(
    () => guides.find((guide) => guide.id === selectedId) ?? guides[0],
    [guides, selectedId]
  );

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>Connection setup</h2>
          <p>
            Every setup card opens a concrete path for n8n, Google Workspace,
            social channels, MCPs, Telegram, HeyGen, and AI providers.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {guides.map((guide) => {
            const Icon = ICONS[guide.icon];
            const active = selected?.id === guide.id;
            return (
              <button
                key={guide.id}
                type="button"
                onClick={() => setSelectedId(guide.id)}
                className={cn(
                  "rounded-2xl border border-accent-champagne/10 bg-ink-950/30 p-4 text-left backdrop-blur-sm transition hover:border-accent-champagne/30",
                  active && "border-accent-champagne/30 bg-accent-gold/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
                    <Icon size={16} />
                  </div>
                  <StatusPill
                    status={guide.configured ? "ok" : "warn"}
                    label={guide.configured ? "ready" : "setup needed"}
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-ink-100">
                  {guide.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-300">
                  {guide.detail}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="chip">{guide.scope}</span>
                  {guide.envNames.slice(0, 2).map((envName) => (
                    <span key={envName} className="chip font-mono">
                      {envName}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <aside className="card-padded h-fit">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label">Selected setup</p>
                <h3 className="mt-1 text-lg font-semibold text-ink-100">
                  {selected.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-300">
                  {selected.detail}
                </p>
              </div>
              <StatusPill
                status={selected.configured ? "ok" : "warn"}
                label={selected.configured ? "ready" : "setup needed"}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-accent-champagne/10 bg-ink-950/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                Required names
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.envNames.map((envName) => (
                  <span key={envName} className="chip font-mono">
                    {envName}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                Setup steps
              </p>
              <ol className="mt-2 space-y-2">
                {selected.steps.map((step, index) => (
                  <li key={step} className="flex gap-2 text-sm leading-relaxed text-ink-300">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-accent-champagne/20 bg-accent-gold/10 text-[10px] text-accent-champagne">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {(selected.ownerAction || selected.teamAction) && (
              <div className="mt-4 grid gap-2">
                {selected.ownerAction && (
                  <p className="rounded-xl border border-accent-champagne/10 bg-ink-950/30 p-3 text-xs leading-relaxed text-ink-300">
                    <span className="font-semibold text-ink-100">Owner: </span>
                    {selected.ownerAction}
                  </p>
                )}
                {selected.teamAction && (
                  <p className="rounded-xl border border-accent-champagne/10 bg-ink-950/30 p-3 text-xs leading-relaxed text-ink-300">
                    <span className="font-semibold text-ink-100">Team: </span>
                    {selected.teamAction}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl border border-accent-champagne/10 bg-ink-950/40">
              <div className="grid aspect-video place-items-center border-b border-accent-champagne/10">
                <Video size={22} className="text-accent-champagne/80" />
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-ink-100">
                  {selected.videoPlaceholder}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Tutorial placeholder. Add the approved walkthrough video when ready.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selected.href && (
                <a
                  href={selected.href}
                  className="btn-secondary h-9 px-3 text-xs"
                >
                  {selected.buttonLabel ?? "Open setup target"}
                </a>
              )}
              <a
                href={SETUP_COACH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary h-9 px-3 text-xs"
              >
                Open Setup Coach
                <ExternalLink size={13} />
              </a>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
