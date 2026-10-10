"use client";
import { Suspense, lazy } from "react";
const Charts = lazy(() => import("./revenue-charts"));
export function BusinessCharts({
  monthly,
  destinations,
  currency,
  exponent,
}: {
  monthly: { month: string; revenue_minor: string }[];
  destinations: { destination: string; bookings: number }[];
  currency: string;
  exponent: number;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="h-72 animate-pulse rounded-xl bg-muted"
          aria-label="Loading business charts"
        />
      }
    >
      <Charts
        monthly={monthly}
        destinations={destinations}
        currency={currency}
        exponent={exponent}
      />
    </Suspense>
  );
}
