# Phase 3: native itinerary studio

The legacy reference is a bundled, approximately 44 MB standalone brochure editor. It is retained under `legacy-itinerary/` for reference and is never imported into the application bundle.

## Native workflow

Customers are linked by database ID. An itinerary persists its header and ordered days in one transaction. The native React editor provides Trip, Days, Pricing, Design, Route and Terms sections, with a deferred live preview. Drafts can be saved before every day is reviewed; destination changes clear the image and review flag. Unsaved changes trigger a browser departure warning.

The day editor supports adding, removing and reordering up to 30 days, day narratives, morning/afternoon/evening activities, hotels, rooms, meal plans, photo credits, descriptions and focal points. The design editor provides nine palettes and custom colors with a text-contrast guard. Automatic and custom routes collapse consecutive duplicate stops; the Sri Lanka map is illustrative and lists unmapped stops.

Pricing supports up to 20 custom or catalog lines. Quantity remains independent of traveler count. Selling prices, costs, discounts and taxes use exact integer minor units and the same rounding logic as formal quotations. Costs and supplier identifiers are excluded from shared views. “Create quotation” performs the database conversion and opens the saved quotation.

Saved itineraries can be edited, duplicated and exported or previewed as A4 PDFs. The company name and safely loaded logo come from Settings. Duplication preserves the linked customer, days and prices while removing sharing permissions. PDFs are generated lazily on the server with `@react-pdf/renderer`, keeping that renderer out of editor bundles.

## Photos and sharing

Eight actual photographs from the supplied tool are preserved as optimized local images (1.38 MB total), with author, license and original source links. The extraction script reads only metadata and encoded image data; it does not execute the legacy application.

JPEG/PNG uploads are limited to 5 MB and 20 million decoded pixels, validated and normalized to at most 1400 × 1000 pixels with Sharp. Metadata is stripped and files receive immutable UUID names. During local development they persist under the ignored local data directory; hosted deployments use private Supabase Storage. Uploaded photos are served through permission-checked routes. Public photo routes validate a live share token and confirm that the photo belongs to that itinerary.

Share links expire after 30 days and can be revoked or rotated. The public view excludes customer identity, internal costs and supplier/service IDs. Sharing does not grant anonymous table access. Hosted sharing uses a server-only service key for an exact token lookup. Development sharing uses the local database even when hosted environment values exist.

## Deliberate legacy changes

- The large embedded application and photo bundle are replaced by native components and optimized reusable assets.
- Standard PDF fonts replace embedded display fonts. The emerald palette is retained; the remaining palettes and map outline are native interpretations rather than a pixel-identical reconstruction.
- The map preserves ordered stops and illustrative routing; it does not provide live directions or paid map APIs.
- Saved database records replace temporary tab drafts and blob URLs. Customer-facing share links replace local-only proposals.
- Multiple currencies, costs, discounts and explicit tax rates replace the original USD-only pricing.
- Library images and uploads appear in PDFs. Other external HTTPS image URLs remain available for web previews; PDF fetching is limited to the trusted Wikimedia image host, avoiding arbitrary server requests.
- PDFs use automatic page wrapping instead of the old jsPDF overflow algorithm. Long paragraphs may produce additional pages.
- Cover cropping uses the native centered cover layout; day photos retain editable focal points.
- Day review checks are visible reminders, allowing incomplete drafts to be saved and reviewed progressively.

## Verification

`npm exec vitest -- run tests/itineraries.test.ts tests/itineraries-database.test.ts tests/itineraries-media.test.ts` covers exact prices, date boundaries, route ordering, validation, atomic persistence, duplication, role checks, sharing rotation/revocation, upload persistence and path guards.

`npm run test:e2e:crm -- itinerary.spec.ts` exercises saved photos, public sharing and revocation, safe cost omission, duplication and PDF generation on desktop and mobile.

Private editor/detail previews read the same request-cached company settings as the workspace. Public shared pages read only the company name after a valid, unexpired token lookup; image requests do not repeat that branding query. Branding is not duplicated in itinerary content.
