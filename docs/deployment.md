# Deployment and operation

## Accounts and cost

Create a Supabase Free project at https://supabase.com/dashboard, using a strong database password and a region near the agency. No payment is required by this application. Project quotas, storage limits and inactive-project pauses still apply.

Create a Vercel personal account for non-commercial evaluation, import the Git repository and select Next.js. Vercel Hobby permits non-commercial personal use only ([current policy](https://vercel.com/docs/plans/hobby)). A travel agency's commercial production hosting needs an eligible plan or another host; the application does not purchase infrastructure or promise otherwise.

Resend is optional. Create a free account only if needed, verify a sending domain and add the API key/sender. Test mode uses an unconfigured sender and never sends mail.

## Database

For a new empty hosted project, apply every SQL file in `supabase/migrations` in timestamp order, or use a linked Supabase CLI `db push` after checking the target and pending versions. For the existing EIMTS-TravelsCRM project, the baseline and workflow migrations are already applied and history matches source; do not paste them again into SQL Editor.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
```

Inspect the dry-run before `db push`. Never run `db reset` against business data. Retain applied migration files unchanged; add new migrations for later changes. Back up schema/business data before major changes and export/backup Storage separately. Provider backup availability depends on plan.

## Environment

Configure production and preview env vars separately in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`: hosted project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable/anon-compatible browser key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for token-controlled sharing and explicit administrative tools. Never prefix this with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL`: exact HTTPS deployment origin.
- `RESEND_API_KEY`, `EMAIL_FROM`: optional customer document delivery.
- `CRM_DEFER_AUTH=false`: hosted identity is required regardless of this flag; local development bypass never runs under `NODE_ENV=production`.

Do not set `CRM_LOCAL_DATA_DIR` for hosted operation. Local PGlite is development-only and never persists business data on Vercel. Provision initial Admin separately with the environment-configured seed script; builds must not create accounts or mutate schema.

Build command is `npm run build`, install command is `npm ci`; no custom output directory. Use Node.js 24. No database password belongs in browser env vars.

## Release checks

Complete the final login/user-management phase and configure Supabase Auth site URL and exact callback/reset URLs before business release. Disable public sign-up. Verify Admin, Agent and Accountant separately with real hosted sessions; local role tests prove SQL behavior but do not establish provider configuration.

Verify actual Storage logo/photo uploads, shared photo access and expiry/revocation, a complete quotation-to-payment cycle, PDF content, optional email delivery and payment/credit audit history. Do not import local demo data into a live agency accidentally.

Monitor free quotas and PDF/email request failures. PDFs are generated on demand; private document storage is available for later archiving. Credits do not initiate a bank refund; reconcile refunds separately. This app records payments and does not process cards or contact banks.
