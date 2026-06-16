# Email Intake — QA Checklist (Phase 1)

Run before considering the intake system ready to activate. Each item is a
pass/fail gate. Many map directly to the non-negotiable Phase 1 safety rules.

## Security / webhook auth

- [ ] **Secret rejection works.** A request with a **missing or wrong**
      `x-legendsos-webhook-secret` header is rejected **401 `unauthorized`** on
      all four routes.
- [ ] **Unconfigured server fails closed.** With `LEGENDSOS_WEBHOOK_SECRET`
      unset, all four routes return **503 `intake_not_configured`**.
- [ ] **No secret leakage.** The secret value never appears in any response body,
      log line, or error message.
- [ ] **No env leakage.** No env values are printed anywhere.

## Classification

- [ ] **Needs Review when AI is off.** With no usable AI provider, low-confidence
      messages resolve to `unknown_needs_review` with `classified_by = "none"` —
      the classifier **never guesses** a category.
- [ ] Rule classifier returns a sensible category + confidence for clear cases;
      low-confidence cases escalate to the hard pass (or Needs Review).
- [ ] Phishing/spam-looking samples are flagged appropriately (and only generate
      **internal** alerts).

## Safety invariants

- [ ] **No customer sends.** Nothing in the pipeline sends a customer-facing
      email. There is no external alert channel.
- [ ] **No deletes / no mark-read.** Nothing deletes emails/attachments or marks
      Gmail messages read or changes labels.
- [ ] **Attachments only to Needs Review.** Every recorded attachment has
      `drive_location = needs_review_folder`; a `document-intake` payload with
      `drive_location = borrower_folder` is rejected **400 `invalid_payload`**.
- [ ] **No auto-filing.** No attachment reaches `borrower_folder` / `filed`
      without a human-confirmed match + approval (later phase).
- [ ] **Alerts human-gated.** New alerts are `decision = "pending"`; `pending`
      never becomes a dispatch; `dispatched_at` is only stamped on `approved`
      alerts.
- [ ] **Loan match human-gated.** `loan-update` webhook only writes `suggested`;
      `confirmed` from a webhook is rejected.

## Idempotency / data integrity

- [ ] **Dedupe on `gmail_message_id`.** POSTing the same `email-intake` sample
      twice (same `source_account` + `gmail_message_id`) inserts **one** row;
      the second response reports `deduped: true`.
- [ ] `is_sample = true` on all sample-generated rows; sample data is obviously
      fake (no real borrower names, no real loan IDs).
- [ ] Audit rows are written for webhook receipts, classifications, approvals,
      and routing decisions.

## Graceful degradation

- [ ] With the migration **not** applied (tables missing), webhooks return a
      benign `recorded: false` body (no 500), and pages render a setup-needed
      state.

## App surface (admin-only)

- [ ] Intake pages are gated to admin/owner (`isAdminOrOwner`); non-admins are
      redirected to `/dashboard`.
- [ ] No dead buttons — every control works, is disabled-with-label, or is
      removed. Pending/setup-needed states are honest.
- [ ] Light/dark dual classes used (no bare `text-ink-100` / `bg-ink-950`).

## Build health

- [ ] **Lint green.**
- [ ] **Typecheck green.**
- [ ] **Build green.**
- [ ] **n8n workflows inactive** until the activation checklist's final step.

> Note: this agent (DOCS) does **not** run npm/lint/build — those gates are
> executed by the build/QA owner. This checklist defines the bar they must hit.
