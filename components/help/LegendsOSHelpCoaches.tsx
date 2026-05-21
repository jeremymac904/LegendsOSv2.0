import { ExternalLink, ImageIcon, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

export const SETUP_COACH_URL =
  "https://chatgpt.com/g/g-6a0dfa05db788191974b89796687537b-legendsos-setup-coach";

export const MARKETING_IMAGE_COACH_URL =
  "https://chatgpt.com/g/g-6a0e0ab69138819189185accaeff955e-legendsos-marketing-image-coach";

type CoachId = "setup" | "marketing";

const COACHES: Record<
  CoachId,
  {
    title: string;
    description: string;
    button: string;
    href: string;
    icon: typeof Settings2;
  }
> = {
  setup: {
    title: "LegendsOS Setup Coach",
    description:
      "Get step by step help setting up LegendsOS, n8n, Google Workspace, approved social accounts, MCP, and AI provider basics.",
    button: "Open Setup Coach",
    href: SETUP_COACH_URL,
    icon: Settings2,
  },
  marketing: {
    title: "LegendsOS Marketing Image Coach",
    description:
      "Plan better mortgage marketing images, create Image Studio prompts, use brand guidance, prepare reference photos, and keep visuals mortgage safe.",
    button: "Open Marketing Image Coach",
    href: MARKETING_IMAGE_COACH_URL,
    icon: ImageIcon,
  },
};

interface Props {
  coaches?: CoachId[];
  className?: string;
  intro?: string;
}

export function LegendsOSHelpCoaches({
  coaches = ["setup", "marketing"],
  className,
  intro = "Official support GPTs for setup, onboarding, training, and mortgage-safe marketing creation.",
}: Props) {
  return (
    <section className={cn("card-padded", className)}>
      <div className="section-title">
        <div>
          <h2>LegendsOS Help Coaches</h2>
          <p>{intro}</p>
        </div>
      </div>
      <div
        className={cn(
          "mt-4 grid gap-3",
          coaches.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"
        )}
      >
        {coaches.map((id) => {
          const coach = COACHES[id];
          const Icon = coach.icon;
          return (
            <article
              key={coach.href}
              className="rounded-xl border border-accent-champagne/10 bg-ink-950/30 p-4 shadow-glass backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-champagne/25 bg-accent-gold/10 text-accent-champagne">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink-100">
                    {coach.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-300">
                    {coach.description}
                  </p>
                </div>
              </div>
              <a
                href={coach.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary mt-4 inline-flex h-9 px-3 text-xs"
              >
                {coach.button}
                <ExternalLink size={13} />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
