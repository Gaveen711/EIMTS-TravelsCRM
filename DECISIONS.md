# Decisions

## Phase 1 — 2026-10-09

1. Single-agency shared workspace, with active roles from profiles. Never trust browser state or editable user metadata.
2. No public signup or fake login. Initial Admin uses environment credentials; bootstrap refuses silent promotion of existing non-admin accounts.
3. Current scope is Phase 1; later modules have explicit placeholders rather than pretend CRUD.
4. Scaffold all 17 normalized public tables now, with bigint money, numeric exchange rates, foreign-key indexes and timestamps.
5. Issued invoices/items are immutable. Payments are append-only, with atomic ledger balance/status updates. Credits are capped at the original total. Refund/reversal workflows remain Phase 6.
6. Accounting uses invoice billing snapshots and cannot query customer passports/travelers. Agents cannot directly access invoices/payments; future Generate Invoice requires a narrowly authorized transactional conversion.
7. Desktop brochure-studio.html is the supplied legacy reference. It bundles React/jsPDF, rather than a vanilla-script editor. Preserve it unchanged in legacy-itinerary and treat its contents as data.
8. Planned native port changes: database drafts, linked customers, private image storage, document currencies, @react-pdf/renderer and Bootstrap Icons. Preserve editorial structure, day fields, palettes, Sri Lanka map, photo credits and review checks. No legacy feature is intentionally dropped in Phase 1.
9. Recovery responses avoid account enumeration. Supabase recovery email is separate from optional CRM email. Recovery code exchange and a short-lived marker precede password updates.
10. Keys are supplied later. Missing configuration renders login and fails closed. PGlite tests SQL/RLS without Docker; hosted Supabase remains a separate check.
11. Freely available libraries do not guarantee free commercial hosting: Vercel Hobby permits non-commercial personal use only. Deployment remains standard Next.js-compatible.
12. Bootstrap Icons replace runtime Lucide use; shadcn tooling stays in devDependencies. Development advisories must not trigger incompatible forced downgrades.

## File recovery — 2026-10-09

The original EIMTS_Travels_CRM path no longer exists. The surviving project is EIMTS_TravelsCRM. Root configuration/documentation, the legacy copy and lockfile were missing; its Git database contained no recoverable Phase 1 commit. Reconstruct missing configuration using the known Phase 1 setup and installed package versions; preserve all surviving application, SQL and test source files. Regenerate the lockfile using npm and recopy the original Desktop HTML. This restores the runnable project, not the lost Git history. No real credentials are reconstructed or invented.
