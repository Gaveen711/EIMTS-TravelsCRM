# Supabase backend verification

Project: EIMTS-TravelsCRM (ikjmgsphaftmfdzgjvxa).

Foundation and catalog existed before this run, applied manually via SQL Editor. Inspection confirmed all 17 public CRM tables have RLS, customer RPCs exist, and private logo/PDF buckets exist. No active Admin profile or hosted customer rows existed at inspection. Those records were not fabricated or modified.

Applied through the explicitly requested Supabase plugin:

- phase3_itineraries: native atomic saves and duplicate/share.
- finance_workflows: exact transactional quotations, bookings, invoices, payments, credits, permission-scoped conversions, numbering and financial immutability.
- consultant_insights_settings: grouped reporting and restricted public execution of the Supabase event-trigger helper.
- native_itinerary_boundaries: native JSON pricing/color/date validation and compatible duplicate handling.
- itinerary_photo_storage: private 5 MB JPEG/PNG bucket and role policies.

Read-only verification confirmed the expected workflow functions and retained RLS. Unit integration tests execute actual migrations and exercise role denial, direct API bypasses, locks, totals, conversions, payments, credit reconciliation and reporting. Hosted browser authentication and storage/provider delivery remain final release checks.

Security advisor after the five workflow migrations: no public CRM SECURITY DEFINER warnings; private.document_counters has RLS without policies intentionally because only tightly scoped private numbering functions access it. Leaked password protection is an Auth-stage setting still disabled. Its availability must be checked for the selected free plan without buying paid features.

Migration history was reconciled after verifying baseline objects: foundation/catalog were recorded without rerunning DDL, and plugin-generated versions were mapped to the unchanged local source timestamps. All seven hosted versions match supabase/migrations. Business records and schema were preserved during this metadata repair.

Private numbering counters intentionally have no client policies ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). The deferred Auth warning refers to [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), which is a paid-plan feature; no paid feature was enabled.
