import { FlaskConical } from "lucide-react";

// A clear, consistent "this is demo data" banner for the Loan Brain role
// surfaces (My Loans, Processing, Coordinator). Shown until a live read-only
// Drive connection + real loans exist. Pure presentational — no data, no I/O.
//
// Theme-aware: uses the existing status palette + light/dark utility classes so
// it reads well in both modes (no second theme system).
export function SampleModeBanner({
  note = "Demo loan records only · no borrower data · nothing here is sent or written to Drive.",
}: {
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-status-warn/30 bg-status-warn/10 px-4 py-2.5 text-xs text-status-warn backdrop-blur-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.16em]">
        <FlaskConical size={13} className="shrink-0" />
        Sample mode
      </span>
      <span className="text-status-warn/90">{note}</span>
    </div>
  );
}
