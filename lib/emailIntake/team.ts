// LegendsOS v2 — Gmail AI Intake team roster (Phase 1 defaults).
// -------------------------------------------------------------------------
// These are the team mailboxes LegendsOS will watch (via inactive n8n Gmail
// triggers). They PREFILL /email-intake/settings; the owner confirms each and
// enables intake per member. Nothing is watched until intake_enabled is set.
//
// EMAILS: only addresses provided by the owner are included. Where an address
// is unknown it is `null` (gmail: null) — the settings page renders an
// "admin setup needed" field. We do NOT invent addresses.
//
// These are internal team work addresses, not borrower PII.

import type { IntakeRoleLabel } from "./types";

export interface RosterMember {
  fullName: string;
  /** Watched Gmail/Workspace address, or null when the owner must supply it. */
  gmail: string | null;
  roleLabel: IntakeRoleLabel;
  /** True only when a real address is known; false => admin setup needed. */
  emailConfirmed: boolean;
}

export const INTAKE_ROSTER: RosterMember[] = [
  { fullName: "Jeremy McDonald", gmail: "jeremy@mcdonald-mtg.com", roleLabel: "owner", emailConfirmed: true },
  // Unknown — confirm in /email-intake/settings (not invented).
  { fullName: "Ashley Rogers", gmail: null, roleLabel: "processor", emailConfirmed: false },
  { fullName: "Geraldine", gmail: null, roleLabel: "coordinator", emailConfirmed: false },
  { fullName: "Hugo Calvillo", gmail: "hugo.calvillo@loanfactory.com", roleLabel: "loan_officer", emailConfirmed: true },
  { fullName: "Eric Ritchie", gmail: "eric.ritchie@loanfactory.com", roleLabel: "loan_officer", emailConfirmed: true },
  { fullName: "Raleigh", gmail: null, roleLabel: "loan_officer", emailConfirmed: false },
  { fullName: "Barbara", gmail: null, roleLabel: "loan_officer", emailConfirmed: false },
  { fullName: "Bryan Payne", gmail: "bryan.payne@loanfactory.com", roleLabel: "loan_officer", emailConfirmed: true },
  { fullName: "Scott Mason", gmail: "scott.mason@loanfactory.com", roleLabel: "loan_officer", emailConfirmed: true },
  { fullName: "Jared Goldfarb", gmail: "jared.goldfarb@loanfactory.com", roleLabel: "loan_officer", emailConfirmed: true },
  { fullName: "Brandon Ingram", gmail: "brandon.ingram@loanfactory.com", roleLabel: "loan_officer", emailConfirmed: true },
];

export const INTAKE_ROSTER_CONFIRMED = INTAKE_ROSTER.filter((m) => m.emailConfirmed);
export const INTAKE_ROSTER_NEEDS_EMAIL = INTAKE_ROSTER.filter((m) => !m.emailConfirmed);
