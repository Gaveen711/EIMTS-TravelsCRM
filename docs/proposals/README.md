# RLS policy consolidation proposal

This directory contains a **proposal**, not an active Supabase migration. The application and hosted database continue to use their existing permission policies.

## Proposed change

`consolidate_crm_policies.sql` merges overlapping permissive policies so each CRM table and effective command has one applicable authenticated policy. It preserves the current single-agency Admin, Agent and Accountant rights, self-profile reads, inactive-user restrictions, file-folder boundaries, financial triggers and append-only audit/payment ledgers. Storage photo objects remain immutable; the proposal does not add photo deletion permissions.

The SQL was moved out of `supabase/migrations` so `supabase db push` cannot inadvertently apply it.

## Why it remains a proposal

Automatic approval review rejected applying this SQL to the hosted database because it performs a broad, persistent rewrite of permissions. The hosted policies were not changed by that rejected action. Applying this proposal requires explicit approval of that permissions change and must go through the normal migration review and verification process. Do not retry through another tool or channel to bypass the rejection.

## Local evidence

`tests/rls-consolidation.test.ts` loads all actual migrations into an isolated PGlite PostgreSQL database, then explicitly applies this proposal **only in that test database**.

Six regression tests check:

- Agency-wide sales access and administrator management rights.
- Accounting booking/catalog read access, financial writes, issued-document locks and append-only payments.
- Self-profile reads without role escalation, plus inactive/unprofiled/anonymous restrictions.
- Storage visibility and uploads by role, bucket and document folder.
- Logo update and PDF deletion rights without expanding photo/PDF update permissions.
- At most one permissive authenticated policy per effective command, including expansion of `FOR ALL`, and retained `UPDATE WITH CHECK`.

Run:

```powershell
npm.cmd test -- tests/rls-consolidation.test.ts
npm.cmd test
```

These checks prove local PostgreSQL behavior under the supplied Auth/Storage fixtures. They do not prove hosted application or advisor results. After approval, inspect the hosted policy inventory, create a fresh reviewed migration with the Supabase CLI, apply it, rerun role/storage checks and inspect Supabase security/performance advisors.
