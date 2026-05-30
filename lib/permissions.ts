import type { Profile, UserRole } from "@/types/database";

export function isOwner(profile: Profile | null | undefined): boolean {
  return profile?.role === "owner";
}

export function isAdminOrOwner(profile: Profile | null | undefined): boolean {
  return profile?.role === "owner" || profile?.role === "admin";
}

export function isProcessor(profile: Profile | null | undefined): boolean {
  return profile?.role === "processor";
}

export function isCoordinator(profile: Profile | null | undefined): boolean {
  return profile?.role === "coordinator";
}

export function isLoanOfficer(profile: Profile | null | undefined): boolean {
  return profile?.role === "loan_officer";
}

export function isRole(
  profile: Profile | null | undefined,
  ...roles: UserRole[]
): boolean {
  return Boolean(profile && roles.includes(profile.role));
}

// Navigation gate. Frontend-only — RLS still enforces on the database side.
// `roles` grants visibility to the listed roles; owner/admin always pass a
// role gate so Jeremy sees every operator surface.
export interface NavGate {
  ownerOnly?: boolean;
  adminOrOwner?: boolean;
  roles?: UserRole[];
}

export function canSee(profile: Profile | null | undefined, gate: NavGate): boolean {
  if (!profile) return false;
  if (gate.ownerOnly) return isOwner(profile);
  if (gate.adminOrOwner) return isAdminOrOwner(profile);
  if (gate.roles && gate.roles.length > 0) {
    return isAdminOrOwner(profile) || gate.roles.includes(profile.role);
  }
  return true;
}
