import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  supportedCurrencies as currencies,
  currencyExponent,
} from "@/lib/catalog/schema";
export type Insights = {
  currency: string;
  revenue_minor: string;
  outstanding_minor: string;
  refund_due_minor: string;
  overdue_count: number;
  awaiting_quotes: number;
  customers: number;
  conversion_rate: number;
  departures: {
    id: string;
    destination: string;
    start_date: string;
    traveler_count: number;
    status: string;
  }[];
  attention: {
    id: string;
    number: string;
    billing_name: string;
    due_date: string;
    outstanding_minor: string;
  }[];
  destinations: { destination: string; bookings: number }[];
  monthly: { month: string; revenue_minor: string }[];
};
export const loadInsights = cache(async (currency: string) => {
  const db = await createClient();
  const { data, error } = await db.rpc("consultant_insights", {
    p_currency: currencies.includes(currency as (typeof currencies)[number])
      ? currency
      : "USD",
  });
  if (error)
    throw new Error(
      "Business reports could not be loaded. Check the database migrations and try again.",
    );
  return data as Insights;
});
export function displayMoney(value: string | number, currency: string) {
  const amount = BigInt(value),
    exponent = currencyExponent(currency),
    scale = BigInt(10) ** BigInt(exponent);
  const absolute = amount < BigInt(0) ? -amount : amount;
  return `${currency} ${amount < BigInt(0) ? "-" : ""}${(absolute / scale).toLocaleString("en-US")}${exponent ? "." + (absolute % scale).toString().padStart(exponent, "0") : ""}`;
}
