# Emerald Isle Travels CRM

A connected consultant workspace for Customer → Itinerary → Quotation → Booking → Invoice → Payment. Next.js App Router, TypeScript, Tailwind, shadcn/ui and Bootstrap Icons; Supabase PostgreSQL/Auth/Storage; React PDF, Zod, React Hook Form and Recharts.

## Local development without login

Use Node.js 24 LTS. On Windows PowerShell use npm.cmd.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Development opens directly into the consultant desk. No API keys or password are needed: the local PostgreSQL engine persists data in ignored .crm-data and applies SQL migrations on startup. It supplies an example customer, supplier and service. Restart the server after adding migrations.

Local records are separate from Supabase. This is a deliberate development mode while login is deferred. Production never enables it and retains identity/RLS checks. Do not deploy this unfinished checkout as an open business database. Configuration and final access work remain necessary before hosted business use.

## Modules

Customers include individuals/companies, contact/passport details, tags, pipeline stages, activity history, search and CSV import/export. Suppliers and services hold contacts, payment terms, currency, exact cost/selling prices and tax rates.

Itineraries provide native trip/day editing and previews, reorder, route maps, themes/photos, customer-linked database drafts, duplication, PDF and expiring/revocable sharing. Their pricing and dates flow into quotations.

Quotations support catalog/custom lines, fractional quantities, tax/discount, dates, validity, currency/exchange rate and branded PDF. Accepted quotations convert once into bookings, copying their items. Bookings track travelers, confirmations, costs, selling prices and profit excluding tax. Generate deposit/partial/balance invoices without retyping.

Issued invoices lock in the database. Payments update balances atomically; partial payments and credit notes preserve the audit history. Reports show issued revenue after credits, outstanding balances, overdue documents, departures, conversion and destinations separately by currency. Company settings control branding, bank/tax details, numbering and terms/email templates. Auth/user administration is the final stage.

## Supabase setup

Create a free Supabase project. Copy .env.example to .env.local and enter project URL, publishable key and a server-only service-role key for explicit administration scripts. Never expose a service-role key through NEXT_PUBLIC_ variables.

SQL source lives in supabase/migrations. The supplied CRM project already has the foundation and catalog SQL applied manually. Workflow migrations are applied through the Supabase plugin; see docs/backend-verification.md for the recorded verification. Existing baseline history and workflow versions have been reconciled with local filenames; inspect migration status before future db push. Do not rerun applied files in SQL Editor.

For a disposable local Supabase database, install Docker and the Supabase CLI:

```sh
npx supabase start
npx supabase db reset
```

Reset deletes local data; use it only with a disposable local Supabase target. It does not reset the separate PGlite .crm-data directory.

Initial Admin provisioning is available for the final Auth stage:

```sh
npm run seed:admin
npm run seed:demo
```

Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (at least 12 characters) and SEED_ADMIN_NAME first. Scripts load .env.local; no shared hosted credentials are shipped. Bootstrap refuses silent promotion of an existing non-admin user. Demo seeding uses stable IDs and preserves existing edits.

## Email and files

Private Supabase buckets store company logos and itinerary photos. Local development stores uploads below .crm-data. Server routes produce branded PDFs on demand without a paid PDF API.

Optional customer email uses RESEND_API_KEY and EMAIL_FROM. An unconfigured or failed sender reports a clear fallback to downloading the PDF. Email templates support customer, document, total and due_date placeholders. No email is sent by build or seed scripts.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e:crm
npm run test:e2e
```

Vitest executes real PostgreSQL migrations, RLS and triggers in PGlite. Browser suites exercise persisted customers/catalog, native itinerary sharing/photos/PDF and the connected sales cycle on desktop and phone. Browser tests use isolated ignored local databases. Run browser suites sequentially because their Next.js build directory is shared.

Current checkpoint: 105 unit/database tests and 14 desktop/mobile browser cases pass. Typecheck, lint and production build pass; details are in [verification evidence](docs/verification.md).

Passing local tests does not prove hosted Auth, email delivery, Storage upload configuration or Vercel deployment. These require separate final verification. Do not commit .env, .env.local, .crm-data or private exports.

## Architecture and deployment

src/app contains routes; src/components small UI; src/lib validation, database and business logic. SQL migrations own transactional document invariants. Server guards and RLS enforce roles; invoicing uses safe billing snapshots so accounting cannot read customer passports.

Lists and detail views render on the server. PDF renderer stays server-only. Charts load separately, icons use a generated Bootstrap sprite, and financial dashboards aggregate in one database call. Run node scripts/build-icons.mjs after adding icons.

Import as a standard Next.js project on Vercel when the final access stage is ready. Configure environment variables in the dashboard, apply migrations separately and update Supabase redirects. Never reset databases or provision users during build.

Vercel Hobby restricts hosting to non-commercial personal use: https://vercel.com/docs/plans/hobby. Personal evaluation and commercial agency hosting have different eligibility; the app purchases no paid services.

See [deployment instructions](docs/deployment.md), DECISIONS.md, docs/legacy-analysis.md and the phase reports for scope, verification and remaining release work.
