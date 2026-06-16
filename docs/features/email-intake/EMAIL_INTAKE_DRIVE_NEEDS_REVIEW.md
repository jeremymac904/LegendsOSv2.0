# Email Intake — Google Drive "Needs Review" Strategy (Phase 1)

## Principle

In Phase 1, **every captured attachment goes to ONE place: the Google Drive
"Needs Review" folder.** Nothing is filed into a borrower's folder, and nothing
is ever deleted. The Needs Review folder is a human-reviewed holding area, not a
destination of record.

## Why a single Needs Review folder

- **No mis-filing.** An attachment can only end up in a borrower folder by
  mistake if automation writes there. By routing everything to Needs Review, a
  wrong loan match never contaminates a real borrower file.
- **Human-in-the-loop by construction.** Filing requires a confident match **and**
  explicit human approval (a later phase). Until then, a person opens Needs
  Review, confirms the loan, and approves the move.
- **Reversible.** Files in Needs Review can be re-routed or ignored. Auto-filing
  is hard to undo; auto-deleting is impossible to undo — so neither happens.

## Routing rules

| Situation | Drive location | Attachment `status` |
| --- | --- | --- |
| Unknown classification | `needs_review_folder` | `needs_review` |
| No loan match / `unmatched` | `needs_review_folder` | `needs_review` |
| Loan match only **suggested** (not human-confirmed) | `needs_review_folder` | `needs_review` |
| Suspicious file (see below) | `needs_review_folder` | `suspicious` (+ `suspicious_reason`) |
| Confident match **+ human approval** | `borrower_folder` | `filed` — **later phase only** |

In Phase 1 the only `drive_location` automation may write is
**`needs_review_folder`**. The `document-intake` webhook **rejects**
`borrower_folder` payloads.

## Suspicious attachment handling

When n8n/heuristics flag a file, it is recorded with `status = "suspicious"` and
a human-readable `suspicious_reason`. It still goes **only** to Needs Review.
Common reasons:

- executable / script / macro-bearing types (`.exe`, `.js`, `.scr`, `.htm`,
  macro-enabled Office docs),
- mismatched extension vs MIME type,
- password-protected archives,
- attachments arriving with phishing-risk-classified messages,
- abnormally large or zero-byte files.

Suspicious files are **never opened, executed, auto-renamed, or auto-filed.**
They wait for a human.

## What automation must NOT do

- ❌ Write to any `borrower_folder` in Phase 1.
- ❌ Delete, overwrite, or move out of Needs Review automatically.
- ❌ Mark the source email read or modify Gmail labels.
- ❌ Rename/repackage suspicious files.
- ❌ Skip the Needs Review folder for "obvious" matches — a suggested match is
  still only a suggestion.

## Borrower-folder filing (later phase, documented for intent)

A future phase may move an attachment from Needs Review into a borrower folder.
The gate is strict and **all** conditions must hold:

1. `loan_match_status = "confirmed"` (a human confirmed the loan), **and**
2. a human explicitly approves the file move in the LegendsOS app, **and**
3. the action is written to `email_intake_audit`.

Only then does `drive_location` become `borrower_folder` and `status` become
`filed`. Even then, the original is moved (never deleted) and the move is logged.

## Configuration

- The Needs Review folder ID is supplied to n8n/Drive automation as an env/config
  value (e.g. `EMAIL_INTAKE_NEEDS_REVIEW_FOLDER_ID`). It is **never** printed in
  logs or responses.
- Attachment rows store `drive_file_id` and `drive_url` so reviewers can open the
  file directly from the LegendsOS attachment queue.
