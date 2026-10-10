/* eslint-disable @next/next/no-img-element */
import { memo } from "react";
import type { ItineraryInput } from "@/lib/itineraries/schema";
import { moneyInput } from "@/lib/catalog/schema";
import { endDate, pricingTotals } from "@/lib/itineraries/schema";
import { RouteMap } from "./route-map";
export const ItineraryPreview = memo(function ItineraryPreview({
  input,
  customerName = "",
  companyName = "Emerald Isle Travels",
  shared = false,
}: {
  input: ItineraryInput;
  customerName?: string;
  companyName?: string;
  shared?: boolean;
}) {
  let totals: ReturnType<typeof pricingTotals> | null = null;
  try {
    totals = pricingTotals(input);
  } catch {
    /* Incomplete draft fields remain editable. */
  }
  return (
    <div className="flex flex-col gap-5">
      <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div
          className="p-6 text-white"
          style={{ backgroundColor: input.primary_color }}
        >
          <p className="text-xs tracking-[0.2em]">{companyName}</p>
          <h2 className="my-4 font-serif text-3xl">{input.title}</h2>
          <p>
            {input.destination} · {input.days.length} days ·{" "}
            {input.adults + input.children} travelers
          </p>
          <p className="mt-2 text-sm">
            {input.start_date} — {endDate(input.start_date, input.days.length)}
          </p>
          {customerName && !shared && (
            <p className="mt-4 text-sm">Prepared for {customerName}</p>
          )}
        </div>
        {input.cover_image && (
          <figure>
            <img
              loading="lazy"
              src={input.cover_image}
              alt={input.cover_alt || input.destination}
              className="h-48 w-full object-cover"
            />
            {input.cover_credit && (
              <figcaption className="p-2 text-xs text-muted-foreground">
                {input.cover_credit}
              </figcaption>
            )}
          </figure>
        )}
        <div className="p-6">
          <p className="whitespace-pre-line">
            {input.summary || "Your personal journey starts here."}
          </p>
          {input.arrangements && (
            <p className="mt-4 whitespace-pre-line text-sm">
              {input.arrangements}
            </p>
          )}
        </div>
      </article>
      <RouteMap input={input} />
      {input.days.map((day, index) => (
        <article
          key={index}
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="p-5">
            <p className="text-xs font-semibold text-muted-foreground">
              DAY {index + 1} · {day.destination}
            </p>
            <h3
              className="mt-2 font-serif text-2xl"
              style={{ color: input.primary_color }}
            >
              {day.title}
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm">
              {day.description}
            </p>
          </div>
          {day.image_url && (
            <figure>
              <img
                src={day.image_url}
                alt={day.photo_alt || day.destination}
                loading="lazy"
                className="h-44 w-full object-cover"
                style={{
                  objectPosition: day.focal_x + "% " + day.focal_y + "%",
                }}
              />
              {day.photo_credit && (
                <figcaption className="p-2 text-xs text-muted-foreground">
                  {day.photo_credit}
                </figcaption>
              )}
            </figure>
          )}
          <dl className="grid gap-3 p-5 text-sm">
            {(["morning", "afternoon", "evening"] as const).map(
              (time) =>
                day[time] && (
                  <div key={time}>
                    <dt className="font-semibold capitalize">{time}</dt>
                    <dd className="whitespace-pre-line text-muted-foreground">
                      {day[time]}
                    </dd>
                  </div>
                ),
            )}
            {day.accommodation && (
              <div>
                <dt className="font-semibold">Stay</dt>
                <dd>
                  {day.accommodation} {day.rooms} · {day.meals}
                </dd>
              </div>
            )}
          </dl>
        </article>
      ))}
      {input.pricing.length > 0 && (
        <article className="rounded-xl border bg-card p-5">
          <h3 className="font-serif text-2xl">Your quotation</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {input.pricing.map((item, i) => (
              <div key={i} className="flex justify-between gap-4">
                <span>
                  {item.description} × {item.quantity}
                </span>
                <span>
                  {input.currency}{" "}
                  {totals
                    ? moneyInput(totals.lines[i].total_minor, input.currency)
                    : item.unit_price}
                </span>
              </div>
            ))}
          </div>
          {totals && (
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-sm">
              <dt>Subtotal</dt>
              <dd className="text-right">
                {input.currency}{" "}
                {moneyInput(totals.subtotal_minor, input.currency)}
              </dd>
              <dt>Discount</dt>
              <dd className="text-right">
                {moneyInput(totals.discount_minor, input.currency)}
              </dd>
              <dt>Tax</dt>
              <dd className="text-right">
                {moneyInput(totals.tax_minor, input.currency)}
              </dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">
                {input.currency}{" "}
                {moneyInput(totals.total_minor, input.currency)}
              </dd>
            </dl>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Includes line discounts and tax. Formal quotation confirms final
            travel arrangements.
          </p>
        </article>
      )}
      {[
        ["Inclusions", input.inclusions],
        ["Exclusions", input.exclusions],
        ["Terms and conditions", input.terms],
      ]
        .filter(([, text]) => text)
        .map(([title, text]) => (
          <section className="rounded-xl border bg-card p-5" key={title}>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {text}
            </p>
          </section>
        ))}
      {input.consultant && (
        <footer className="rounded-xl border p-5 text-sm">
          Your travel consultant: {input.consultant}
          <br />
          {input.consultant_email} · {input.consultant_phone}
        </footer>
      )}
    </div>
  );
});
