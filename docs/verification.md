# Verified consultant workspace

Verified 10 October 2026. This is the local business-workflow checkpoint; hosted identity/user administration remains the final phase.

| Check | Result |
| --- | --- |
| Unit, validation, PostgreSQL/RLS, money, conversion, billing, storage/media, branding | 105 passing tests across 19 files |
| Financial/settings browser flow | 6 desktop/mobile cases pass |
| Customers/catalog/itinerary browser flow | 8 desktop/mobile cases pass |
| TypeScript | Pass |
| ESLint | Pass, no warnings |
| Production Next.js build | Pass, no warnings |
| Production dependency audit | Zero reported vulnerabilities |
| Running production server | Protected workspace/API requests redirect; invalid public share returns 404 |
| Deployment tracing | Development database, local records and legacy HTML are absent from production route traces |
| Supabase migrations | Seven applied versions match source; all 17 public CRM tables protected by RLS |

Financial browser coverage includes itinerary pricing/dates into a quotation, accepted conversion to booking, traveler/confirmation updates, issued invoice locking, partial/final payments, persistent reload, actual PDFs, company defaults/logo, report CSV and visible Recharts surfaces. Email is explicitly unconfigured in tests, so no real message is sent.

CRM browser coverage includes create/edit customers, pipeline/activity/search, CSV import/export, exact service pricing, linked supplier protection, archiving, photos normalized/uploaded and persisted, sharing with omitted internal costs, token revocation, duplicate/edit and actual PDF generation. Both phone and desktop layouts are exercised.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:crm
npm run test:e2e
npm audit --omit=dev
```

Run browser suites sequentially. They use fresh `.crm-test-data` databases and `.next-crm-tests`, separate from normal development records. TypeScript excludes the isolated browser-build directory to avoid stale route validators from earlier test builds.

The Supabase security advisor retains the intentional private counter INFO and the Pro-only leaked-password warning. Performance notices include unused indexes in the empty hosted database and overlapping working role policies. A tested policy consolidation is recorded separately in `docs/proposals`; automatic approval review rejected its broad persistent authorization rewrite, so it is not an active migration and was not applied remotely.

Full local results do not establish hosted Auth/SMTP/Storage/provider delivery or deployment readiness. Configure keys, provision the real Admin, finish login/user administration, then verify real sessions and hosted uploads. Local records are not copied to hosted Supabase.

After final company-branding and chart-animation edits, targeted itinerary and settings checks passed again on both phone and desktop. Refreshed screenshots show completed chart rendering. The original 44 MB legacy HTML remains unchanged.

Business-workflow implementation checkpoint: `a0879ad`. The hardening documentation and isolated policy-proposal tests are committed separately; no proposal is placed in active migrations.
