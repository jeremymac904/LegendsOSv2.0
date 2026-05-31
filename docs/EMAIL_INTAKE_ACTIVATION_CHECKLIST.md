# Email Intake — Activation Checklist (Go-Live)

Ordered steps to take Gmail AI Intake from "built but inactive" to live, **one
mailbox at a time**. Do these in order. Do not skip the inactive/test stages.

> Safety reminder: Phase 1 only records + queues for human review. No customer
> sends, no deletes, no auto-marking-read, no auto-filing to borrower folders.

---

## 1. Apply the database migration

- [ ] Apply `supabase/migrations/20260531000000_email_intake.sql` in the Supabase
      SQL editor or via CLI. (It is **not** auto-applied.)
- [ ] Apply the companion RLS migration `*_email_intake_rls.sql`.
- [ ] Confirm the 5 tables exist: `email_intake_team`, `email_intake_messages`,
      `email_intake_attachments`, `email_intake_alerts`, `email_intake_audit`.

## 2. Set server environment variables

Set these in the server environment (Vercel/host). **Never** commit or print them.

- [ ] `LEGENDSOS_WEBHOOK_SECRET` — long random shared secret for the webhooks.
- [ ] Public base URL of the app (e.g. `NEXT_PUBLIC_APP_URL` / deployment URL) so
      n8n knows where to POST.
- [ ] `EMAIL_INTAKE_NEEDS_REVIEW_FOLDER_ID` — the Google Drive "Needs Review"
      folder ID (the only Drive target in Phase 1).
- [ ] Confirm `isWebhookSecretConfigured()` returns true (the settings page shows
      a configured/ not-configured status).

## 3. Configure per-mailbox Gmail credentials (in n8n)

- [ ] Connect Gmail/Workspace credentials for each watched mailbox in n8n.
- [ ] Keep every Gmail trigger **inactive** for now.

## 4. Confirm team roster + the 4 unknown emails

- [ ] In `/email-intake/settings`, review the prefilled roster (11 members).
- [ ] Supply the 4 still-missing internal team emails:
      **Ashley Rogers**, **Geraldine**, **Raleigh**, **Barbara**.
      (See `EMAIL_INTAKE_ADMIN_SETUP.md`.)
- [ ] Leave `intake_enabled = false` for **all** members at this stage.

## 5. Import n8n workflows (keep inactive)

- [ ] Import the four intake workflows (email-intake, document-intake,
      alert-intake, loan-update) into n8n.
- [ ] Point each HTTP node at the correct LegendsOS webhook URL.
- [ ] Add the `x-legendsos-webhook-secret` header (value = `LEGENDSOS_WEBHOOK_SECRET`).
- [ ] **Leave all workflows inactive.**

## 6. Test with sample payloads (no real mailbox)

- [ ] POST each sample body from `docs/email-intake-test-payloads/` to its
      webhook with the correct secret header. Confirm `2xx` + a recorded row.
- [ ] POST with a **missing** secret → expect **401 `unauthorized`**.
- [ ] Temporarily unset the secret → expect **503 `intake_not_configured`**
      (then restore it).
- [ ] POST the same `email-intake` sample twice → second is **deduped**.
- [ ] Confirm sample rows are flagged `is_sample = true` and contain only
      obviously-fake data.
- [ ] Verify attachments landed only in the Needs Review folder; no borrower
      folder was touched; no customer email was sent.

## 7. Flip ONE mailbox active last

- [ ] Pick a single low-risk mailbox (e.g. the owner's own).
- [ ] Set that member's `intake_enabled = true` in settings.
- [ ] Activate **only that mailbox's** n8n Gmail trigger.
- [ ] Watch the LegendsOS intake queue + audit log for a few real messages.
- [ ] Confirm: messages recorded, classification sensible, alerts stay `pending`
      until approved, attachments only in Needs Review, no sends/deletes.
- [ ] Only after this looks healthy, enable additional mailboxes one at a time.

---

## Rollback / kill switch

- Set the offending member's `intake_enabled = false` and deactivate that n8n
  trigger to stop ingestion immediately.
- Rotating `LEGENDSOS_WEBHOOK_SECRET` instantly invalidates all webhooks
  (everything fails 401 until n8n is updated).
- Recorded rows are review-only; there is nothing to "unsend."
