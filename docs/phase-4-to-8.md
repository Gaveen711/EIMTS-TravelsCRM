# Phases 4–8: connected consultant workspace

Authentication screens and user administration remain deferred, as requested. Local development opens the consultant workspace directly. Server authorization and database role policies remain in place for the final hosted access stage.

## Built

| Phase | Delivered behavior |
| --- | --- |
| 4 — Quotations | Catalog/custom items, quantities, cost/selling prices, discounts, taxes, dates, validity, currency/manual exchange rate, company terms, exact totals, status transitions, branded PDF and optional email. Native itinerary conversion carries pricing and dates into the quotation. |
| 5 — Bookings | Accepted quotations convert transactionally into linked bookings. Travelers, supplier confirmations and references, assigned consultant and booking status are editable. Cost, profit excluding tax and margin remain visible. |
| 6 — Invoices and payments | Booking conversion supports deposit, partial and balance invoices. Issued documents are locked; adjustments use voids or issued credit notes. Cash/bank/card/other payments update balances atomically. Partial payments, credits and refund amounts display separately. Branded PDFs include billing, tax and bank details. |
| 7 — Dashboard and reports | Issued revenue after credits, outstanding and overdue balances, upcoming departures, awaiting quotations, conversion and destination charts. Reports and CSV keep currencies separate. |
| 8 — Settings | Company/contact/tax/bank details, default currency, tax rates, document numbering, quotation/invoice terms, email templates and logo upload. Final login and user management follow later. |

Financial forms use React Hook Form and Zod, preserve database snapshots when editing, and wait for hydration before enabling controls. Lists and details render on the server. PDF/sharp dependencies stay server-only; optional email fails gracefully when unavailable. Logo rendering reads bounded workspace-owned image bytes and normalizes them to a small PNG; missing or corrupt logos do not prevent export.

## Verification

```sh
npm run test:e2e
npm test -- tests/pdf-logo.test.ts
npm run typecheck
npm run lint
```

The final workflow suite passed **6/6 tests in 56.1 seconds**, covering desktop and phone:

- Itinerary → quotation → booking → invoice → partial payment → final payment, persisted after reload.
- Real itinerary/quotation/invoice PDF responses, sent-document locks and direct edit-route protection.
- Traveler details, supplier confirmations, service costs, required fields and currency precision validation.
- Optional email fallback with provider variables deliberately blank in the browser fixture.
- Company settings/logo persistence, native invoice customer choices, inherited quotation terms, embedded PDF logo and report CSV.
- Two visible Recharts surfaces on both dashboard and reports, plus viewport overflow checks.

The four logo unit tests passed, including URL/path rejection, image normalization, corrupt/oversized input and private-storage failure. TypeScript and scoped finance/PDF/workflow lint passed. Screenshots are saved under `docs/screenshots`; chart animation was subsequently disabled for stable final visual captures.

## Hosted limits and next verification

These results use an isolated local PostgreSQL database with the actual migrations, policies and triggers. They do not establish hosted session behavior, live email delivery, Supabase Storage configuration or Vercel deployment. Consult `backend-verification.md` for the remote migration record rather than reapplying SQL.

Customer/catalog/itinerary browser checks (8/8), final build, typecheck and lint now also pass. Next: restore branded login, password recovery, initial Admin provisioning and role-aware user administration; verify each role against hosted Supabase before business deployment. Follow `deployment.md` for environment configuration and hosting eligibility.
