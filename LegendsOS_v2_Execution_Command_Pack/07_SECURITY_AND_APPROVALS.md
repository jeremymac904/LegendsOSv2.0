# Security and Approval Rules

## General

This is an internal mortgage team platform.

Security must be simple and correct.

## Authentication

Use Supabase Auth.

## Authorization

Use role based access:

- owner
- admin
- loan_officer

## Owner only

Only Jeremy can:

- see team usage
- manage users
- manage provider keys
- override cost caps
- see all team modules
- access audit logs
- approve production publish features

## Loan officer

Loan officers can:

- use their own Atlas chat
- create social drafts
- generate images within cap
- create email drafts
- view their own activity
- view shared team resources

They cannot:

- see other loan officers' private chat
- see other loan officers' usage details unless allowed
- manage provider keys
- publish without configured workflow permissions
- access owner admin

## Approval gates

Require explicit approval before:

- sending email
- publishing social posts
- spending money
- running paid generation
- destructive database migration
- deleting records
- changing role permissions
- deploying to production

## Secrets

Never expose full secrets in browser or logs.

Show only:

- configured
- missing
- disabled
- error

## Audit logging

Log:

- login
- chat message sent
- file uploaded
- image generated
- social draft created
- social publish requested
- email draft created
- email send requested
- settings changed
- provider key status changed

## Mortgage compliance

Marketing output should support compliance review.

Social and email content should include compliance line when applicable:

Jeremy McDonald, NMLS 1195266, The Legends Mortgage Team powered by Loan Factory, NMLS 320841.
