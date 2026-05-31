import Link from "next/link";
import {
  Apple,
  ArrowLeft,
  Chrome,
  MonitorDown,
  Move,
  PanelTop,
  ShieldCheck,
} from "lucide-react";

import { DesktopStatusBadge } from "@/components/desktop/DesktopRuntime";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const dynamic = "force-dynamic";

export default function DesktopSetupPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Desktop setup"
        title="Install and run LegendsOS on Mac"
        description="Use this page to confirm the native shell, install the Mac build, and understand the current Windows path. The desktop app is still a thin native work window around the production LegendsOS web app."
        action={
          <Link href="/settings" className="btn-ghost text-xs">
            <ArrowLeft size={13} />
            Back to settings
          </Link>
        }
      />

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Desktop status</h2>
            <p>
              If you are inside the native app, this page should show a desktop
              badge. If no badge appears, you are in a regular browser.
            </p>
          </div>
          <DesktopStatusBadge />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatusCard
            icon={<Move size={15} />}
            title="Movable window"
            body="Drag the top app bar. Interactive buttons and inputs remain clickable."
          />
          <StatusCard
            icon={<PanelTop size={15} />}
            title="Mac chrome spacing"
            body="Traffic lights are offset from app content and the layout has a usable minimum size."
          />
          <StatusCard
            icon={<Chrome size={15} />}
            title="Browser companion"
            body="The companion remains a Chrome/Edge extension and pairs with the same LegendsOS session."
          />
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Mac install instructions</h2>
            <p>Use the DMG produced by the desktop build.</p>
          </div>
          <Apple size={16} className="text-ink-400" />
        </div>
        <ol className="mt-4 grid gap-2 text-sm text-ink-700 dark:text-ink-300">
          <Step n={1}>Download the latest <code className="chip font-mono">LegendsOS.dmg</code>.</Step>
          <Step n={2}>Open the DMG and drag <span className="font-medium">LegendsOS</span> into <span className="font-medium">Applications</span>.</Step>
          <Step n={3}>Launch from Applications. If macOS warns about an unsigned beta, right-click the app, choose <span className="font-medium">Open</span>, then confirm.</Step>
          <Step n={4}>Sign in with your LegendsOS team account. The session is stored in the app window, separate from Safari/Chrome.</Step>
          <Step n={5}>Open <Link href="/browser-companion/setup" className="font-medium text-accent-gold underline">Browser Companion setup</Link> if you need portal capture routing.</Step>
        </ol>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Windows build path</h2>
            <p>Prepared but secondary to the Mac sprint.</p>
          </div>
          <MonitorDown size={16} className="text-ink-400" />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
          The repository already exposes <code className="chip font-mono">npm run desktop:build:windows</code>,
          configured for an NSIS installer. Validate Mac first, then smoke test
          Windows on a real Windows machine for installer prompts, window chrome,
          login, and Browser Companion routing.
        </p>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Security boundary</h2>
            <p>The native shell stays thin for this sprint.</p>
          </div>
          <ShieldCheck size={16} className="text-ink-400" />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
          Node integration remains disabled in the renderer. The preload exposes
          only a read-only desktop marker for UI detection. Agentic work-browser
          capabilities should be added later behind explicit IPC allowlists.
        </p>
      </section>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-accent-gold/25 bg-accent-gold/10 text-accent-gold">
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
        {body}
      </p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-accent-gold/30 bg-accent-gold/10 text-[11px] font-semibold text-accent-gold">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
