# Email Intake — Admin Setup (for Jeremy)

This is the human setup the owner completes in **`/email-intake/settings`** and
the server environment before activation. Everything here concerns **internal
team work mailboxes** — not borrower PII.

> The roster is **prefilled** from `lib/emailIntake/team.ts`. Addresses are only
> included where the owner supplied them; unknown addresses are `null` and render
> as an "admin setup needed" field. No addresses are invented, and none are
> seeded into the database — the owner enters/confirms them in settings.

---

## The 11 team members

| # | Full name | Role | Gmail / Workspace address | Status |
| --- | --- | --- | --- | --- |
| 1 | Jeremy McDonald | owner | `jeremy@mcdonald-mtg.com` | ✅ confirmed |
| 2 | Ashley Rogers | processor | — | ⚠️ **needs email** |
| 3 | Geraldine | coordinator | — | ⚠️ **needs email** |
| 4 | Hugo Calvillo | loan_officer | `hugo.calvillo@loanfactory.com` | ✅ confirmed |
| 5 | Eric Ritchie | loan_officer | `eric.ritchie@loanfactory.com` | ✅ confirmed |
| 6 | Raleigh | loan_officer | — | ⚠️ **needs email** |
| 7 | Barbara | loan_officer | — | ⚠️ **needs email** |
| 8 | Bryan Payne | loan_officer | `bryan.payne@loanfactory.com` | ✅ confirmed |
| 9 | Scott Mason | loan_officer | `scott.mason@loanfactory.com` | ✅ confirmed |
| 10 | Jared Goldfarb | loan_officer | `jared.goldfarb@loanfactory.com` | ✅ confirmed |
| 11 | Brandon Ingram | loan_officer | `brandon.ingram@loanfactory.com` | ✅ confirmed |

- **7 confirmed emails:** Jeremy, Hugo, Eric, Bryan, Scott, Jared, Brandon.
- **4 still needed:** **Ashley Rogers**, **Geraldine**, **Raleigh**, **Barbara**.

These are **internal team emails** (work mailboxes LegendsOS watches), not
customer/borrower addresses.

---

## What Jeremy must configure

### A. Supply the 4 missing internal team emails
In `/email-intake/settings`, fill the "admin setup needed" field for each:

- [ ] **Ashley Rogers** (processor) — enter her work Gmail/Workspace address.
- [ ] **Geraldine** (coordinator) — enter her work address.
- [ ] **Raleigh** (loan_officer) — enter their work address.
- [ ] **Barbara** (loan_officer) — enter their work address.

(If a full last name is known, update it while you're there.)

### B. Confirm the 7 known emails
- [ ] Verify each confirmed address is current and correct (typos block ingestion
      because messages route by `source_account` / mailbox).

### C. Set per-member role + notify preferences
- [ ] Confirm each `role_label` (owner / loan_officer / processor / coordinator /
      assistant / other).
- [ ] Set `notify_preferences` per member (channels, min severity, mute types,
      quiet hours). See `EMAIL_INTAKE_ALERT_ROUTING.md`.

### D. Keep intake OFF until activation
- [ ] Leave `intake_enabled = false` for **every** member during setup. Mailboxes
      are only watched once intake is enabled **and** the n8n trigger is active.

### E. Server environment (not in the settings page)
- [ ] `LEGENDSOS_WEBHOOK_SECRET` — shared webhook secret.
- [ ] App base URL — so n8n can reach the webhooks.
- [ ] `EMAIL_INTAKE_NEEDS_REVIEW_FOLDER_ID` — Google Drive Needs Review folder ID.

> None of these env values are ever printed in the app, logs, or webhook
> responses.

---

## Notes

- Adding/confirming an email does **not** start watching it. Activation is a
  separate, deliberate step — see `EMAIL_INTAKE_ACTIVATION_CHECKLIST.md`.
- The settings page persists into `email_intake_team`. If the migration is not
  yet applied, the page shows a setup-needed state and persists nothing.
