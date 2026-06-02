"use client";

// =============================================================================
// PersistentNotesPanel — per-loan notes saved to component state
// =============================================================================
// STATE: notes are stored in a Map keyed by folderId in the parent
// ProcessorCockpit. They survive file-switching within the session, but are
// LOST on page reload.
//
// TODO (DB persistence):
//   Requires migration: loan_notes table
//     id uuid PK
//     loan_id uuid FK -> loans.id (or folder_id text for sample compat)
//     body text
//     updated_at timestamptz default now()
//     created_by uuid FK -> profiles.id
//
//   API route needed: POST /api/processing/notes (upsert by loan_id + user_id)
//   Trigger save on blur or debounce 1500ms after last keystroke.
//   On mount: GET /api/processing/notes?loanId=xxx to hydrate state.
// =============================================================================

import { Save, StickyNote } from "lucide-react";

interface PersistentNotesPanelProps {
  folderId: string;
  value: string;
  onChange: (value: string) => void;
}

export function PersistentNotesPanel({ folderId: _, value, onChange }: PersistentNotesPanelProps) {
  return (
    <div className="card-padded space-y-2">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2">
            <StickyNote size={14} className="text-accent-gold" />
            Processor notes
          </h2>
          <p>Saved for this session — clears on page reload.</p>
        </div>
        {/* TODO: show a "Saved to DB" badge here once the API route exists */}
        <span className="inline-flex items-center gap-1 rounded-full border border-status-warn/30 bg-status-warn/10 px-2 py-0.5 text-[10px] text-status-warn">
          <Save size={10} />
          Session only — not persisted
        </span>
      </div>

      {/* TODO (DB): Replace this stub notice with a real "last saved at" timestamp
          once POST /api/processing/notes is wired. The textarea value should also
          be initialized from the API response (GET on mount). */}
      <p className="rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1.5 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
        STUB: notes survive file-switching in this session but reset on reload.
        DB migration required to persist across sessions.
      </p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type processor notes here — they'll survive switching between files in this tab. Reload clears them until DB persistence is wired."
        className="textarea min-h-[100px] text-sm"
        aria-label="Processor notes — session only, not saved to database yet"
      />
    </div>
  );
}
