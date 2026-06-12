"use client";

// Thin client for the Academy state API. Every call fails soft (returns
// null/false) so the hooks transparently fall back to localStorage when the
// user is offline, unauthenticated, or the API errors.

export interface AcademyRemoteState {
  today: Record<string, { fields: Record<string, string>; savedAt: string }>;
  scorecard: { cells: Record<string, number[]>; reflection: Record<string, string> };
  progress: { weeksDone: number[]; graduated: boolean };
}

export async function loadAcademyState(): Promise<AcademyRemoteState | null> {
  try {
    const res = await fetch("/api/academy/state", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.ok) return null;
    return {
      today: json.today ?? {},
      scorecard: json.scorecard ?? { cells: {}, reflection: {} },
      progress: json.progress ?? { weeksDone: [], graduated: false },
    };
  } catch {
    return null;
  }
}

async function post(body: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/academy/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function saveTodayRemote(
  dayKey: string,
  fields: Record<string, string>,
  scorecard?: { cells: Record<string, number[]>; reflection: Record<string, string> },
): Promise<boolean> {
  return post({ kind: "today", dayKey, fields, scorecard });
}

export function saveScorecardRemote(
  cells: Record<string, number[]>,
  reflection: Record<string, string>,
): Promise<boolean> {
  return post({ kind: "scorecard", cells, reflection });
}

export function saveProgressRemote(
  weeksDone: number[],
  graduated: boolean,
): Promise<boolean> {
  return post({ kind: "progress", weeksDone, graduated });
}
