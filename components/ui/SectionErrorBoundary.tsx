"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// Section-level React error boundary.
//
// Wrap any independent UI section so that if its render throws (e.g. a bad data
// shape from an API), only that section degrades to a compact inline error card
// — the rest of the page keeps working. This is the opposite of a page-level
// boundary: it contains the blast radius to one card instead of 500-ing the
// whole route.
//
// Error boundaries must be class components (React has no hook equivalent for
// getDerivedStateFromError / componentDidCatch), so this is intentionally a
// class. It's a client component because boundaries only catch errors thrown
// during client render; server-rendered children pass straight through.

interface SectionErrorBoundaryProps {
  /** Optional label shown in the error card so the user knows which section failed. */
  title?: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    // Flip into the fallback render path on the next render.
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log for diagnostics — never silently swallow. The card below tells the
    // user the section degraded; the console keeps the stack for debugging.
    // eslint-disable-next-line no-console
    console.error(
      `SectionErrorBoundary caught an error${
        this.props.title ? ` in "${this.props.title}"` : ""
      }:`,
      error,
      info.componentStack
    );
  }

  handleReset = (): void => {
    // Reset state so React attempts to re-render the children. If the underlying
    // condition cleared (transient data), the section comes back; if not, the
    // boundary simply catches again and re-shows this card.
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { title } = this.props;
    return (
      <div className="rounded-2xl border border-status-warn/30 bg-status-warn/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={18}
            aria-hidden
            className="mt-0.5 shrink-0 text-status-warn"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              This section couldn&rsquo;t load
            </p>
            {title && (
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                {title}
              </p>
            )}
            <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
              Something went wrong rendering this part of the page. The rest of
              the page keeps working — you can retry just this section.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-secondary mt-3 h-8 px-3 text-xs"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default SectionErrorBoundary;
