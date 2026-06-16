# Email Intake — Webhook Contracts (Phase 1)

n8n is the outside runner; LegendsOS exposes inbound webhooks that **record +
queue** intake events for human review. No webhook ever sends a customer email,
deletes anything, or auto-files to a borrower folder.

## Shared conventions

All four routes:
- `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
- respond with `NextResponse` JSON,
- use the Supabase **service role** (`getSupabaseServiceClient()`) — webhooks have
  no user session,
- **degrade gracefully** if a table is missing (record nothing, return a benign
  body; do not 500),
- **never log or echo** the webhook secret or any env value.

### Authentication — `x-legendsos-webhook-secret`

Every request MUST present the shared secret in the
**`x-legendsos-webhook-secret`** header, matching `LEGENDSOS_WEBHOOK_SECRET` on
the server. Verification is **fail-closed** and constant-time
(`verifyWebhookSecret` in `lib/emailIntake/webhook.ts`).

| Condition | HTTP | Body |
| --- | --- | --- |
| Server secret unset (intake not provisioned) | **503** | `{ "ok": false, "error": "intake_not_configured", "message": "Email intake is not provisioned. Set LEGENDSOS_WEBHOOK_SECRET in the server environment." }` |
| Header missing or wrong | **401** | `{ "ok": false, "error": "unauthorized", "message": "Missing or invalid webhook secret." }` |
| Valid | proceed | endpoint-specific success body below |

> The secret value is never returned in any response.

### Common success/error shape

```jsonc
// success
{ "ok": true, "recorded": true, "id": "<row-uuid-or-null>", "deduped": false }
// validation error (bad/missing body fields)
{ "ok": false, "error": "invalid_payload", "message": "<what was wrong>" }
// table missing (migration not applied) — still a 200-class benign response
{ "ok": true, "recorded": false, "reason": "intake_tables_unavailable" }
```

---

## 1) `POST /api/webhooks/email-intake`

Ingests one email's metadata, classifies it, and queues it for review.
Idempotent: dedupes on `(source_account, gmail_message_id)`.

### Request
```json
{
  "source_account": "watched-mailbox@example.com",
  "team_member_gmail": "watched-mailbox@example.com",
  "gmail_message_id": "MSG-SAMPLE-0001",
  "gmail_thread_id": "THREAD-SAMPLE-0001",
  "from_address": "sender@example.com",
  "from_name": "Sender Name",
  "to_address": "watched-mailbox@example.com",
  "subject": "Subject line",
  "snippet": "First ~200 chars of the body for triage.",
  "received_at": "2026-05-30T15:04:05Z",
  "has_attachments": true,
  "raw_headers": { "Message-ID": "<...>", "List-Unsubscribe": "..." },
  "is_sample": true
}
```
Required: `source_account`, `gmail_message_id`. Everything else optional.
`team_member_gmail` is resolved to a `team_member_id` when it matches a row in
`email_intake_team`; otherwise stored unlinked.

### Behavior
1. Verify secret.
2. Upsert on `(source_account, gmail_message_id)` — if the row already exists,
   return `deduped: true` and do **not** re-classify.
3. Classify via `classifyEmail()` (cheap rules → DeepSeek hard pass → else
   `unknown_needs_review`). If no AI is configured, the item stays
   `unknown_needs_review` with `classified_by: "none"`.
4. Set `status` (`needs_review` when unknown/low-confidence, else `classified`).
5. Write an `email_intake_audit` row (`action: "webhook_received"`).

### Response
```json
{
  "ok": true,
  "recorded": true,
  "deduped": false,
  "message_id": "<uuid>",
  "classification": "promotional",
  "classification_confidence": 0.65,
  "classified_by": "rule",
  "status": "classified"
}
```

---

## 2) `POST /api/webhooks/document-intake`

Records one attachment for the attachment review queue. Phase 1 only ever
targets the Drive **Needs Review** folder.

### Request
```json
{
  "source_account": "watched-mailbox@example.com",
  "gmail_message_id": "MSG-SAMPLE-0001",
  "file_name": "document.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 482311,
  "gmail_attachment_id": "ATT-SAMPLE-0001",
  "drive_location": "needs_review_folder",
  "drive_file_id": "DRIVE-SAMPLE-FILE-0001",
  "drive_url": "https://drive.google.com/file/d/DRIVE-SAMPLE-FILE-0001/view",
  "status": "needs_review",
  "suspicious_reason": null,
  "is_sample": true
}
```
Required: `gmail_message_id` (to resolve the parent message) and `file_name`.
`drive_location` defaults to `needs_review_folder`; **`borrower_folder` is
rejected in Phase 1** (no auto-filing). If the attachment looks risky, n8n sets
`status: "suspicious"` + `suspicious_reason`.

### Behavior
1. Verify secret.
2. Resolve parent `message_id` from `(source_account, gmail_message_id)`. If no
   parent exists yet, record the attachment as orphaned/pending or return
   `recorded: false, reason: "parent_message_not_found"`.
3. Insert attachment row with `drive_location` forced to `needs_review_folder`
   (never `borrower_folder`) and `status` in {`pending_review`,`needs_review`,
   `suspicious`}.
4. Audit (`action: "attachment_recorded"`).

### Response
```json
{
  "ok": true,
  "recorded": true,
  "attachment_id": "<uuid>",
  "message_id": "<uuid>",
  "drive_location": "needs_review_folder",
  "status": "needs_review"
}
```

---

## 3) `POST /api/webhooks/alert-intake`

Records an internal alert **decision** and/or confirms an approved internal
dispatch. Approved alerts are **internal notifications only** — never customer
replies.

### Request — create/queue an alert decision
```json
{
  "source_account": "watched-mailbox@example.com",
  "gmail_message_id": "MSG-SAMPLE-0001",
  "alert_type": "urgent_condition",
  "severity": "high",
  "target_team_member_gmail": "watched-mailbox@example.com",
  "channel": "in_app",
  "decision": "pending",
  "payload": { "reason": "SAMPLE underwriting condition due soon" },
  "is_sample": true
}
```
`channel` must be internal-only (`in_app` | `email_internal` | `telegram` |
`none`). There is no external channel. New alerts default `decision: "pending"`
— **nothing dispatches until a human approves**.

### Request — confirm an approved dispatch (n8n callback)
```json
{
  "alert_id": "<uuid>",
  "dispatched": true,
  "dispatched_at": "2026-05-30T15:10:00Z",
  "is_sample": true
}
```
The webhook only sets `dispatched_at` if the alert row is already
`decision: "approved"` (human gate). It never flips `pending` → dispatched.

### Behavior
1. Verify secret.
2. Validate `channel` is internal-only; reject otherwise with `invalid_payload`.
3. Create the alert (`decision` defaults to `pending`) **or** stamp
   `dispatched_at` on an already-approved alert.
4. Audit (`action: "alert_recorded"` or `"alert_dispatched"`).

### Response
```json
{
  "ok": true,
  "recorded": true,
  "alert_id": "<uuid>",
  "decision": "pending",
  "channel": "in_app",
  "dispatched": false
}
```

---

## 4) `POST /api/webhooks/loan-update`

Records a **suggested** loan match against a message/attachment. Never confirms
or files — confirmation is a human action in the app.

### Request
```json
{
  "source_account": "watched-mailbox@example.com",
  "gmail_message_id": "MSG-SAMPLE-0001",
  "loan_match_id": "00000000-0000-0000-0000-00000000SAMPLE",
  "loan_match_confidence": 0.74,
  "loan_match_status": "suggested",
  "attachment_id": null,
  "is_sample": true
}
```
Required: `gmail_message_id` and `loan_match_id`. `loan_match_status` accepted
values from the webhook are limited to `suggested` (or `unmatched`/`rejected`
clear) — **`confirmed` is rejected** because confirmation must come from a human
in the app, not from n8n.

### Behavior
1. Verify secret.
2. Resolve the message (and attachment if `attachment_id` given).
3. Set `loan_match_id`, `loan_match_confidence`, `loan_match_status: "suggested"`;
   advance message `status` to `loan_matched` if appropriate.
4. Audit (`action: "loan_match_suggested"`).

### Response
```json
{
  "ok": true,
  "recorded": true,
  "message_id": "<uuid>",
  "loan_match_id": "00000000-0000-0000-0000-00000000SAMPLE",
  "loan_match_status": "suggested",
  "loan_match_confidence": 0.74
}
```

---

## Reject-behavior summary

| Failure | HTTP | `error` |
| --- | --- | --- |
| Secret unset on server | 503 | `intake_not_configured` |
| Missing/invalid secret header | 401 | `unauthorized` |
| Missing required fields / bad enum | 400 | `invalid_payload` |
| `drive_location: borrower_folder` (doc-intake) | 400 | `invalid_payload` (auto-filing disallowed Phase 1) |
| `channel` external / `loan_match_status: confirmed` from webhook | 400 | `invalid_payload` (human-gated) |
| Intake tables not applied | 200 | benign `recorded: false`, `reason: intake_tables_unavailable` |
