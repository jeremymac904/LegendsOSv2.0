// LegendsOS — verified team roster (source of truth).
// -------------------------------------------------------------------------
// Imported from the owner-provided team roster TSV (2026-05-31). This is the
// authoritative list of who should have LegendsOS access. /admin/setup compares
// live profiles against this list to show who is provisioned, missing, or has
// the wrong role. Provisioning is MANUAL + non-emailing (the owner clicks
// "Provision" which creates the account with send_invite_email=false and
// returns a copyable setup link) — nothing here sends email or creates accounts
// on its own.
//
// EXCLUDED on purpose (do not re-add): Vivian Delgado, Catherine Brunel,
// Camilia Da La Luz. There is no "Geraldine" guess — Geraldine DaVila is the
// real Loan Coordinator and is included below.
//
// NMLS is intentionally not stored here: it is not in the source roster TSV,
// and we do not backfill it from other (stale) sources.

import type { UserRole } from "@/types/database";

export interface RosterMember {
  /** Full name as it appears on the roster. */
  name: string;
  /** Canonical company email (lowercased). The login/identity email. */
  email: string;
  /** Mapped LegendsOS role. */
  role: UserRole;
  /** Human-readable title from the roster (Team Leader, Loan Officer, ...). */
  title: string;
  /** Direct phone, or null if the roster did not provide one. */
  phone: string | null;
  /** Licensed states (USPS abbreviations), empty when not provided. */
  states: string[];
  /** Other emails this person may already be provisioned under (e.g. the
   *  pre-existing owner login). Used so /admin/setup matches them correctly. */
  altEmails?: string[];
}

// Role mapping: Team Leader -> owner, Loan Officer -> loan_officer,
// Processor -> processor, Loan Coordinator -> coordinator.
export const TEAM_ROSTER: RosterMember[] = [
  {
    name: "Jeremy McDonald",
    email: "jeremy.mcdonald@loanfactory.com",
    role: "owner",
    title: "Team Leader",
    phone: "(904) 506-0181",
    states: ["FL"],
    // Jeremy's existing owner login may already be this address.
    altEmails: ["jeremy@mcdonald-mtg.com"],
  },
  {
    name: "Ashley Rogers",
    email: "ashley@lfprocessing.net",
    role: "processor",
    title: "Processor",
    phone: "(904) 442-3213",
    states: ["FL"],
  },
  {
    name: "Geraldine DaVila",
    email: "geraldine.davila@loanfactory.com",
    role: "coordinator",
    title: "Loan Coordinator",
    phone: null,
    states: [],
  },
  {
    name: "Barbara Jordan",
    email: "barbaraj@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(815) 355-1573",
    states: ["GA", "IL", "IN", "KY", "MO"],
  },
  {
    name: "Bryan Payne",
    email: "bryan.payne@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(470) 426-3475",
    states: ["GA", "VA"],
  },
  {
    name: "Christina Bús",
    email: "christina.bus@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(425) 553-2520",
    states: ["AL", "WA"],
  },
  {
    name: "Eric Jason Ritchie",
    email: "eric.ritchie@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(920) 960-2169",
    states: ["FL", "WI"],
  },
  {
    name: "Hugo Calvillo",
    email: "hugo.calvillo@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(407) 729-3006",
    states: ["FL"],
  },
  {
    name: "Jesus Urquiza",
    email: "jesus.urquiza@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(786) 665-6509",
    states: ["FL"],
  },
  {
    name: "Mark Sileck",
    email: "mark.sileck@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(214) 364-6757",
    states: ["FL"],
  },
  {
    name: "Raleigh Morrison",
    email: "raleigh.morrison@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(941) 769-1362",
    states: ["FL"],
  },
  {
    name: "Alison McLeod",
    email: "alison.mcleod@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(702) 608-0633",
    states: ["CA", "NV", "TX", "UT"],
  },
  {
    name: "Scott Mason",
    email: "scott.mason@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(407) 392-9592",
    states: ["FL"],
  },
  {
    name: "Irene Holden",
    email: "irene.holden@loanfactory.com",
    role: "loan_officer",
    title: "Loan Officer",
    phone: "(386) 244-7808",
    states: ["CA", "FL", "SC"],
  },
];

/** Names explicitly removed from the team — never auto-add these. */
export const ROSTER_EXCLUDED = [
  "Vivian Delgado",
  "Catherine Brunel",
  "Camilia Da La Luz",
];

function norm(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

/** Find a roster member by any of their known emails (case-insensitive). */
export function rosterByEmail(email: string): RosterMember | undefined {
  const e = norm(email);
  return TEAM_ROSTER.find(
    (m) => norm(m.email) === e || (m.altEmails ?? []).some((a) => norm(a) === e)
  );
}

/** All emails (canonical + alt) for matching against live profiles. */
export function rosterEmails(member: RosterMember): string[] {
  return [member.email, ...(member.altEmails ?? [])].map(norm);
}

export const ROSTER_COUNT = TEAM_ROSTER.length;
