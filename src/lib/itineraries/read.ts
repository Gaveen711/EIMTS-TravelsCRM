import "server-only";
import { createClient } from "@/lib/supabase/server";
import { moneyInput } from "@/lib/catalog/schema";
import {
  blankDay,
  blankItinerary,
  itinerarySchema,
  type DayRecord,
  type ItineraryRecord,
} from "./schema";
export async function getItinerary(id: string) {
  const client = await createClient();
  const [header, days] = await Promise.all([
    client.from("itineraries").select("*").eq("id", id).single(),
    client
      .from("itinerary_days")
      .select("*")
      .eq("itinerary_id", id)
      .order("day_number"),
  ]);
  if (header.error || days.error || !header.data) return null;
  return {
    record: header.data as ItineraryRecord,
    days: days.data as DayRecord[],
  };
}
export function itineraryForm(record: ItineraryRecord, days: DayRecord[]) {
  const base = blankItinerary(record.customer_id);
  const legacy = record.legacy_content as Record<string, unknown>;
  const pricing = Array.isArray(legacy.pricing) ? legacy.pricing : [];
  return itinerarySchema.parse({
    ...base,
    ...legacy,
    customer_id: record.customer_id,
    title: record.title,
    destination: record.destination,
    start_date: record.start_date,
    currency: record.currency,
    summary: record.summary || "",
    inclusions: record.inclusions || "",
    exclusions: record.exclusions || "",
    adults: legacy.adults ?? record.traveler_count,
    days: days.map((day) => ({
      ...blankDay(),
      ...(day.services?.[0]?.day_details ?? {}),
      title: day.title,
      description: day.description || "",
      accommodation: day.accommodation || "",
      meals: day.meals || "",
      image_url: day.image_path || "",
    })),
    pricing: pricing.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unit_price: moneyInput(Number(item.unit_price_minor), record.currency),
      cost: moneyInput(Number(item.cost_minor ?? 0), record.currency),
      discount: moneyInput(Number(item.discount_minor ?? 0), record.currency),
      tax_rate: String(item.tax_rate ?? 0),
      service_id: item.service_id ?? "",
      supplier_id: item.supplier_id ?? "",
    })),
  });
}
export async function itineraryChoices() {
  const client = await createClient();
  const [customers, services] = await Promise.all([
    client.from("customers").select("id,name").order("name").limit(1000),
    client
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .limit(1000),
  ]);
  if (customers.error || services.error)
    throw new Error("Unable to load customers and catalog.");
  return {
    customers: customers.data as { id: string; name: string }[],
    services: services.data,
  };
}
