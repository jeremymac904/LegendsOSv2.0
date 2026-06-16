# Email Audiences

A lightweight contact-list system for newsletter targeting. **Not** a CRM —
no pipelines, no opportunities, no portals. Three tables back it:

| Table                          | Holds                                        |
| ------------------------------ | -------------------------------------------- |
| `newsletter_audiences`         | Named lists (e.g. "Florida Realtor Newsletter") |
| `newsletter_contacts`          | The people on those lists                    |
| `newsletter_contact_imports`   | One row per CSV upload (for traceability)    |

Every row is owner-scoped via RLS — Jeremy sees everything; non-owner profiles
only see rows they own.

## How to import the Realtor CSV

1. Sign in as the owner.
2. Open **Email Studio** → **Audiences** (top-right button).
3. Click **Create audience**, name it (e.g. "Florida Realtor Newsletter").
4. Inside the new audience, drop the CSV onto **Import contacts** or click
   to pick a file (up to 20 MB).
5. The first 10 rows preview in-page. If the column names look right, click
   **Import contacts**. The server parses the full file, normalises every
   row, dedupes by `(owner_user_id, email)`, and reports a summary:

   - Total rows parsed
   - New / Updated / In-file duplicates
   - Missing email (skipped)
   - Errors (per-row reasons)

   Errors do not abort the import — bad rows are logged and the rest still
   land.

### Auto-recognised columns

The importer matches by canonical name (case-insensitive), so any of these
header labels work as-is:

```
Full Name, First Name, Last Name,
Email, Email 2,
Phone, Phone 2, Office Phone,
Office Name,
City, State, State License,
Facebook, Instagram, LinkedIn,
X (Twitter), YouTube, TikTok, Zillow,
Other Links,
Transaction Count, Total Volume, Buyer Volume, Buyer Units
```

If a row's primary `Email` is blank but `Email 2` is set, the importer uses
`Email 2` as the dedupe key.

### Status values

Imported contacts default to **active**. The full enum is:

`active`, `unsubscribed`, `bounced`, `do_not_email`, `archived`.

## How to select the audience in Email Studio

Once at least one audience exists with contacts, the composer's recipient
field becomes a **dropdown**. Each option shows
`audience name · <active>/<total>`. Selecting one writes
`recipient_list = audience:<uuid>` on the campaign — n8n workflows can
expand that identifier server-side when external sending is enabled.

If there are no audiences yet, the field falls back to a free-text input
so you can save drafts without a list. Open the **Audiences** button to
create one.

## Limits & safety

- **20 MB** max CSV file size.
- **200-row** server-side batch upserts (so a 5,000-row file is 25 batches).
- Email sends remain gated by `ALLOW_LIVE_EMAIL_SEND`. Importing contacts
  does **not** send anything — it only populates the list.
- Provider secrets stay server-side. The browser only sees `audience:<uuid>`
  and aggregate counts.
