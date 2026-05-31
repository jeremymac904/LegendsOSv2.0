// LegendsOS v2 — weeklyDraft (test-owned helper).
//
// NOTE: The foundation contract for this sprint ships detect / resolve / bundle
// / events / voices / types. A production `weeklyDraft` is NOT part of that
// foundation lib, and Agent TESTS must NOT edit lib/loanMemory/*. So this small,
// pure helper lives with the tests: it proves the SHAPE a weekly pipeline draft
// must take from a LoanMemoryBundle (scenario 6) and gives the UI/agent team a
// reference implementation to lift into lib/ later. It does no I/O.

import type { LoanMemoryBundle } from "../../lib/loanMemory/bundle";
import { getVoice } from "../../lib/loanMemory/voices";

export interface WeeklyDraftItem {
  borrower: string;
  status: string;
  blocker: string;
  nextAction: string;
}

export interface WeeklyDraft {
  voiceId: string;
  signature: string;
  headline: string;
  items: WeeklyDraftItem[];
  body: string;
}

/**
 * Build a weekly pipeline-update draft from one or more loan-memory bundles.
 * Pure: same inputs → same output. Missing values render as "Unknown" (never
 * guessed), matching the loan response rules.
 */
export function weeklyDraft(
  bundles: LoanMemoryBundle[],
  opts: { voiceId?: string; weekOf?: string } = {}
): WeeklyDraft {
  const voice = getVoice(opts.voiceId);
  const items: WeeklyDraftItem[] = bundles
    .filter((b) => b.memory)
    .map((b) => {
      const m = b.memory!;
      return {
        borrower: m.borrower_name ?? "Unknown",
        status: m.current_stage ?? "Unknown",
        blocker: m.main_blocker ?? "None",
        nextAction: m.next_action ?? "Unknown",
      };
    });

  const headline = `Pipeline update${opts.weekOf ? ` — week of ${opts.weekOf}` : ""} (${items.length} active)`;

  const lines: string[] = [headline, ""];
  for (const it of items) {
    lines.push(`• ${it.borrower} — ${it.status}`);
    lines.push(`    Blocker: ${it.blocker}`);
    lines.push(`    Next: ${it.nextAction}`);
  }
  lines.push("", voice.defaultSignature);

  return {
    voiceId: voice.id,
    signature: voice.defaultSignature,
    headline,
    items,
    body: lines.join("\n"),
  };
}
