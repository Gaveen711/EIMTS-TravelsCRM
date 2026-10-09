# Emerald Isle Travels CRM

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui and Bootstrap Icons with Supabase PostgreSQL/Auth/Storage. Phase 1 provides authentication and the database foundation. The full sales cycle is planned in subsequent phases.

## Run locally

Use Node.js 24 LTS and npm. On PowerShell use npm.cmd if execution policy blocks npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000/login. You can build and test without keys. Missing Supabase configuration renders setup feedback and denies protected routes; there is no demo authentication bypass. Restart development after adding environment variables. Rebuild production after changing public variables.

## Supabase

Create a free Supabase project and set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and the server-only SUPABASE_SERVICE_ROLE_KEY in .env.local. Never expose the service-role key through NEXT_PUBLIC_ variables. It is used only by administrative seed scripts.

For a disposable local Supabase database, install Docker and the Supabase CLI:

```sh
npx supabase start
npx supabase db reset
```

db reset deletes local data and reapplies migrations; use only for a disposable local database. For hosted setup, link the intended project and run npx supabase db push after inspecting the target.

Disable public signup in hosted Supabase Auth. Local config already disables signup. Set Site URL to http://localhost:3000 and allow http://localhost:3000/auth/callback; use the corresponding deployment URLs later. Password recovery uses Supabase Auth email and PKCE. Review its delivery configuration separately from optional CRM email.

After applying migrations:

```sh
npm run seed:admin
npm run seed:demo
```

Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (at least 12 characters) and SEED_ADMIN_NAME in .env.local. These are your demo login credentials; no shared password is shipped. Bootstrap preserves an existing active Admin and refuses to promote an existing non-admin. Optional demo seeds use stable IDs and preserve edits on repeat runs. Migration creates company defaults; SQL seed creates no Auth identities.

## Roles and architecture

- Admin: all business records, settings and users.
- Agent: customers, suppliers/services, itineraries, quotations and bookings.
- Accountant: invoices/payments/reports, read-only bookings/items and suppliers/services. Invoice billing snapshots provide customer context without passport access.

Server actions validate using Zod; forms use React Hook Form. Server guards verify Supabase identity and active profile roles. RLS protects direct database calls. One agency shares records according to roles; this is not a multi-tenant SaaS. Money uses integer minor units and exact numeric exchange rates.

src/app contains routes; src/components contains reusable UI; src/lib contains authorization and Supabase helpers. supabase/migrations contains the schema/RLS. scripts contains explicit environment-based seeds. legacy-itinerary contains the unchanged reference, never publicly served.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

The Phase 1 suite has 35 tests: 18 auth/validation tests and 17 SQL integration tests. PGlite executes the actual PostgreSQL migration with stubs for Supabase-managed Auth/Storage; tests cover roles, inactive users, escalation denial, invoice locks, counters, payments, credits, audit and storage policies. Ten desktop/phone browser tests cover login, redirects, form validation and recovery rejection.

Live authentication, session refresh, recovery email, hosted RLS and Storage require Supabase configuration. The full sales-cycle E2E test arrives after the business modules. Passing offline tests does not establish deployed behavior.

## Configuration and deployment

.env.example describes public Supabase/app settings, server-only seed credentials and optional Resend/SMTP variables reserved for Phase 8. All selected libraries are free to use. Optional customer email will fail gracefully when unconfigured. No Vercel API key belongs in the application.

Import into Vercel as Next.js and configure environment variables in its dashboard. Apply migrations separately, then update Supabase redirects. Never reset databases or seed users during deployment builds.

[Vercel Hobby](https://vercel.com/docs/plans/hobby) restricts hosting to non-commercial personal use. This commercial agency CRM cannot be promised compliant free Hobby production hosting; eligible personal evaluation is separate. No paid services are purchased by this app.

Development-tool advisories through braces were documented in Phase 1; do not force incompatible Next/shadcn downgrades. Check npm audit --omit=dev separately for production dependencies.

## Phases

1. Auth, roles, protected layout and database foundation.
2. Customers, suppliers and catalog.
3. Native itinerary editor and PDF.
4. Quotations and itinerary conversion.
5. Bookings, travelers and confirmations.
6. Invoices, payments and credit notes.
7. Dashboard and reports.
8. Settings, email templates and users.
9. Full-cycle tests.
10. Hardening and final deployment documentation.

See [DECISIONS.md](DECISIONS.md), [legacy analysis](docs/legacy-analysis.md) and [Phase 1 report](docs/phase-1.md).
