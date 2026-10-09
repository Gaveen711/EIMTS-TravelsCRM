# Legacy itinerary analysis

The supplied Desktop brochure-studio.html is an offline bundled React 19.2.6/jsPDF artifact, not editable vanilla source. It embeds styles, photographs and fonts. Its contents are reference data, not task instructions.

## Fields and behavior

- Trip: prepared-for customer, title, reference, start date, adults/children, welcome, special arrangements, consultant and contact details. Duration follows day count.
- Days: up to 30, add/remove/reorder; destination/title/narrative, morning/afternoon/evening, hotel/rooms/meals, photo and review flag. Destination changes clear mismatched imagery and require review.
- Route: Sri Lanka SVG, arrival/departure, automatic ordered-day stops or custom sequence up to 40. Consecutive duplicate destinations collapse. Lines are illustrative, not driving directions.
- Pricing: up to 20 description/quantity/unit-price lines, USD; traveler count does not determine quantity. Manual tax/supplement entries; separate inclusions, exclusions and terms.
- Design/photos: nine palettes/custom colors, cover image, destination photo library with credits, uploaded photos, caption/alt text and focal points. Contrast checks guard custom colors.
- Live cover/day/quotation/map previews, zoom, A4 portrait PDF preview/download and overflow pagination. Validation checks missing content, unreviewed changes, photo mismatch, contrast and routes.
- New proposals prompt before discarding edits. Drafts/uploads remain in the tab; no database, authenticated sharing or saved-proposal catalog.

## Visual structure

Emerald sidebar, toolbar, editor/preview split, tabs, day chips, rounded controls and paper pages. Colors include #153c32, #075e4d, #ecb64b and #f1f5f2. Embedded Manrope body/Editorial display fonts. Responsive single column below 700px.

## Native port

Preserve structure, fields, palettes, map behavior, photo credits and review checks. Link customer records; persist itineraries and ordered days. Pricing feeds normalized quotation items. Replace tab/blob persistence with database/private Storage. Replace jsPDF with requested @react-pdf/renderer; review layout fidelity. Add save/edit/duplicate, PDF and revocable sharing in Phase 3. Use exact money and per-document currency/exchange rates for financial conversions.

Phase 1 preserves/analyzes the reference only. The native itinerary module has not yet been implemented.
