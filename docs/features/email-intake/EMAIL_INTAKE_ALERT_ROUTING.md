# Email Intake — Alert Routing Strategy (Phase 1)

## Principle

Alerts are **internal-only** notifications that ping a team member to look at
something. They are **never** customer-facing replies. Every alert passes a
**human approval gate** before anything is dispatched.

```
classification → alert decision → human approval → internal-only dispatch
```

## Stage 1 — classification produces an alert decision

After a message is classified, routing proposes an
`email_intake_messages.internal_alert_decision`:

| Decision | Meaning |
| --- | --- |
| `undecided` | not yet evaluated |
| `no_alert` | triage decided nobody needs pinging |
| `alert_suggested` | routing proposes an alert (creates a `pending` alert row) |
| `alert_approved` | a human approved the internal alert |

Typical classification → suggested alert mapping:

| Classification | Suggested `alert_type` | Default severity |
| --- | --- | --- |
| `phishing_risk` | `phishing_risk` | `high` |
| `underwriting_condition` | `urgent_condition` | `high` |
| `new_lead` | `new_lead` | `normal` |
| `lender_update` / `title_update` / `insurance_update` | `lender_update` / `review` | `normal` |
| `unknown_needs_review` | `review` | `low`–`normal` |
| `promotional` / `spam` | (usually `no_alert`) | — |

Severity levels: **`low`**, **`normal`**, **`high`**, **`urgent`**. Severity is a
hint for ordering/notification, not a license to bypass approval.

## Stage 2 — alert row queued as `pending`

A proposed alert is written to `email_intake_alerts` with
`decision = "pending"`. It carries:

- `alert_type`, `severity`,
- `target_team_member_id` (the internal person who should look),
- `channel` — internal-only: `in_app` | `email_internal` | `telegram` | `none`,
- `payload` (reason/context).

**Nothing is dispatched at this point.**

## Stage 3 — human approval gate

A human (admin/owner) reviews pending alerts in the LegendsOS app and either:

- **Approves** → `decision = "approved"`, `approved_by` + `approved_at` set, the
  message `internal_alert_decision` becomes `alert_approved`; or
- **Dismisses** → `decision = "dismissed"` (no dispatch).

No automation may set `decision = "approved"`. Only a human in the app does.

## Stage 4 — internal-only dispatch

Once a human has approved, n8n may deliver the internal notification on the
chosen internal `channel`. After delivery, n8n calls
`POST /api/webhooks/alert-intake` to confirm, which stamps `dispatched_at`. The
webhook **only** stamps already-`approved` alerts — it can never turn a `pending`
alert into a dispatch.

```
pending ──(human approve)──▶ approved ──(n8n delivers internal)──▶ dispatched_at set
   │
   └──(human dismiss)──▶ dismissed   (no dispatch, ever)
```

## Per-member notification preferences

Each `email_intake_team` member has a `notify_preferences` JSONB blob the owner
sets in settings. Suggested shape (illustrative):

```json
{
  "channels": ["in_app", "email_internal"],
  "min_severity": "normal",
  "mute_types": ["promotional"],
  "quiet_hours": { "start": "21:00", "end": "07:00", "tz": "America/Chicago" }
}
```

Routing uses these to choose `target_team_member_id` and `channel`, and to
suppress low-priority alerts during quiet hours. Preferences shape the
**suggestion** only; the human approval gate still applies.

## Hard rules

- ❌ **Never external.** No alert channel reaches a customer; there is no
  customer/SMS-to-borrower/external channel option.
- ❌ No auto-approve. `pending → approved` is a human action only.
- ❌ No dispatch before approval. `dispatched_at` is only set for `approved`
  alerts via the webhook callback.
- ✅ Every decision and dispatch is written to `email_intake_audit`.
- ✅ `phishing_risk` alerts are informational/internal — they warn the team,
  they do not reply to or engage the sender.
