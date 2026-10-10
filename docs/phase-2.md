> Historical phase record. Current verification uses the local PostgreSQL workspace and skips login; see docs/verification.md for updated results.

# Phase 2: customers, suppliers and services

Built customer create/edit/detail views, indexed search, filters, pagination, pipeline stages, activity notes and validated CSV import/export. Added supplier and services catalog forms, search/filter lists, exact currency prices, tax rules, supplier links and service archiving. Role guards and database RLS enforce access; database functions make customer activity changes atomic.

Verification:

```sh
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run test:e2e:crm
```

Expected: 64 unit/database tests, 10 authentication browser tests and 8 authenticated CRM browser tests. CRM tests start their own isolated Next.js server and PostgreSQL-backed API fixture without credentials. They cover desktop and phone layouts, persisted customers and notes, pipeline changes, CSV transfer, linked supplier restrictions, service prices/archiving and accountant authorization.

For manual use, configure Supabase, apply migrations and run the environment-based seed scripts described in README. No shared production credentials are shipped. Offline tests do not prove hosted Auth, RLS, email delivery or Storage configuration; migrations have not been applied to a hosted project as part of this phase.

Next: Phase 3 ports the preserved legacy itinerary editor into native React components, with linked database drafts, duplication and PDF export.
