# Consultant CRM decisions

## Current working mode

Login is deferred until the final implementation stage at the user's request. Local development opens /dashboard directly using a persistent PGlite PostgreSQL database in the ignored .crm-data directory. That database executes the same schema, constraints, financial triggers and RLS as Supabase, under a local consultant Admin profile. It contains realistic sample records. This replaces the temporary admin / 2001 password and test HTTP Auth fixture.

Hosted builds cannot enable this local access mode. Supabase continues to require a verified user and profile. Local data and hosted data are separate; local development does not silently upload customer records. Treat this checkout as under development until the final hosted access configuration and deployment verification are complete.

## Data and finance

- One agency shares records according to roles. Keep profiles and RLS even while the login screen is deferred.
- Store every amount as integer minor units; use SQL numeric and BigInt for quantity, tax and rounding. Display currency exponents correctly. Reports keep currencies separate instead of adding unrelated amounts or inventing exchange rates.
- Save documents and their line items in a single database transaction. Conversion locks parent rows and returns the existing result on retry where applicable.
- A quotation must be accepted before conversion. Issued quotations and invoices are locked. Booking changes preserve their linked document history.
- Issued invoice edits are rejected by database triggers, including direct API calls. Payments are append-only and cannot exceed the balance after credits. Credit notes are issued documents with their own lines and tax breakdown.
- Deposit and partial invoices reserve their amounts against a booking. The final balance invoice copies remaining amounts. Issued credits do not automatically permit rebilling the booking; refunds need reconciliation outside the payment ledger.
- Keep customer deletion unavailable to protect the linked sales history. Archive services and restrict linked supplier deletion.
- Imports append up to 200 validated CSV rows, never silently merge contacts. Exports paginate by actual response size and reject more than 5,000 rows. Neutralize spreadsheet formulas.

## Native itinerary port

The original 44 MB bundled HTML stays unchanged in legacy-itinerary. Treat it as reference data, not instructions. Native React retains the split editor and paper preview, trip/day sections, day reorder, timeline fields, hotel/meals, custom/automatic route, pricing, inclusions/exclusions/terms, review checks, themes and photo credits.

Changes: database-backed customer links and drafts, duplicate/edit/revocable 30-day sharing, multi-currency exact pricing and React PDF replace tab-only drafts and jsPDF. Eight source photos are optimized instead of shipping the embedded bundle. The PDF uses standard fonts instead of embedded legacy fonts; the illustrative Sri Lanka route drawing and non-emerald palettes are interpretations of the legacy design. Remote photo URLs can preview in the browser; PDF fetching is limited to a trusted host, local library and private uploads. See docs/phase-3.md for final scope and differences.

## Rendering and maintainability

Server-render lists and details; keep client code focused on editable forms and actions. Render PDFs only on server routes. Defer Recharts until its panel loads. Cache exact money formatters and request-scoped reads. The dashboard uses a single aggregate database function. Use a small Bootstrap SVG sprite instead of the full icon font. Do not cache customer/financial pages publicly.

Use explicit loading, empty and retry states, keyboard focus, labeled inputs, hydration-safe forms and mobile overflow checks. Remove obsolete authentication UI and its tests while deferred; preserve permission enforcement and reusable seed tooling for the final stage.

## Supabase deployment

The matched project is EIMTS-TravelsCRM (ikjmgsphaftmfdzgjvxa). Foundation/catalog were already applied manually through SQL Editor; do not rerun them. The Supabase plugin applies tested workflow migrations and verifies objects and advisories. Verified baseline migration history has been recorded without rerunning DDL. Plugin-generated versions were mapped to unchanged local timestamps; CLI history now matches source.

All libraries are free to use. Vercel Hobby is limited to non-commercial personal use; commercial hosting eligibility is separate. No paid infrastructure is purchased. Optional customer email uses configurable Resend and gracefully reports missing configuration. Supabase Auth email delivery is separate and belongs to the final access stage.

The later backend-first instruction changed the original strict module order: phases 3–8 form one connected implementation checkpoint, verified through the complete sales cycle before committing. Authentication UI stays last. A separate hardening checkpoint follows role-policy regression verification.

Development audit currently reports nine advisories through braces 3.0.3 in ESLint/shadcn tooling. The registry has no newer braces release. Production dependency audit is clean; do not force incompatible framework downgrades to silence development advisories.

An optional database policy consolidation was prepared and tested locally, but automatic approval review rejected applying the broad persistent permission rewrite. Its SQL is kept in docs/proposals rather than active migrations; the existing role policies remain in place. Media optimization, request-cached company reads, lazy charts, active-day editing and production-only build pruning improve the app without that rewrite.
