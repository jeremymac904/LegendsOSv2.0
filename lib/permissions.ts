import type { Profile, UserRole } from "@/types/database";

export function isOwner(profile: Profile | null | undefined): boolean {
  return profile?.role === "owner";
}

export function isAdminOrOwner(profile: Profile | null | undefined): boolean {
  return profile?.role === "owner" || profile?.role === "admin";
}

export function isRole(
  profile: Profile | null | undefined,
  ...roles: UserRole[]
): boolean {
  return Boolean(profile && roles.includes(profile.role));
}

// Navigation gate. Frontend-only — RLS still enforces on the database side.
export interface NavGate {
  ownerOnly?: boolean;
  adminOrOwner?: boolean;
}

export function canSee(profile: Profile | null | undefined, gate: NavGate): boolean {
  if (!profile) return false;
  if (gate.ownerOnly) return isOwner(profile);
  if (gate.adminOrOwner) return isAdminOrOwner(profile);
  return true;
}
