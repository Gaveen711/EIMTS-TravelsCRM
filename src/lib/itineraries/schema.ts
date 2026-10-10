import { z } from "zod";
import { calculateTotals } from "@/lib/finance/schema";
import { parseMoney, supportedCurrencies } from "@/lib/catalog/schema";

const text = (max = 5000) => z.string().trim().max(max);
export const imageSchema = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      !value ||
      /^https:\/\/[^\s]+$/.test(value) ||
      /^\/api\/itineraries\/photos\/[a-zA-Z0-9._-]+$/.test(value) ||
      /^\/itinerary-photos\/[a-z-]+\.jpg$/.test(value),
    "Use an HTTPS image URL or an uploaded photo.",
  );
export const themes = [
  { name: "Emerald", primary: "#153c32", accent: "#ecb64b" },
  { name: "Ocean", primary: "#124559", accent: "#f5c765" },
  { name: "Terracotta", primary: "#743d32", accent: "#efc990" },
  { name: "Forest", primary: "#304a34", accent: "#d5c69a" },
  { name: "Midnight", primary: "#232b47", accent: "#cab991" },
  { name: "Plum", primary: "#52334e", accent: "#e1b79e" },
  { name: "Sand", primary: "#665538", accent: "#efd5a0" },
  { name: "Slate", primary: "#3e4d57", accent: "#a8cad0" },
  { name: "Rose", primary: "#713848", accent: "#edc1b5" },
] as const;
export const daySchema = z.object({
  destination: text(160),
  title: text(200).min(1, "Give every day a title."),
  description: text(),
  morning: text(2000),
  afternoon: text(2000),
  evening: text(2000),
  accommodation: text(200),
  rooms: text(200),
  meals: text(200),
  image_url: imageSchema,
  photo_alt: text(200),
  photo_credit: text(500),
  focal_x: z.number().min(0).max(100),
  focal_y: z.number().min(0).max(100),
  reviewed: z.boolean(),
});
export const pricingSchema = z.object({
  description: text(500).min(1, "A price description is required."),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/, "Use up to three decimal places.")
    .refine(
      (v) => Number(v) > 0 && Number(v) <= 999999999,
      "Quantity must be positive.",
    ),
  unit_price: text(40),
  cost: text(40),
  discount: text(40),
  tax_rate: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .refine((v) => Number(v) <= 100, "Tax must be between 0 and 100."),
  service_id: z.union([z.uuid(), z.literal("")]),
  supplier_id: z.union([z.uuid(), z.literal("")]),
});
export const itinerarySchema = z
  .object({
    customer_id: z.uuid("Choose a customer."),
    title: text(200).min(1, "Trip title is required."),
    destination: text(160),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
    adults: z.number().int().min(1).max(999),
    children: z.number().int().min(0).max(999),
    currency: z.enum(supportedCurrencies),
    reference: text(100),
    summary: text(),
    arrangements: text(),
    inclusions: text(),
    exclusions: text(),
    terms: text(),
    consultant: text(160),
    consultant_email: text(254).refine(
      (v) => !v || z.email().safeParse(v).success,
      "Enter a valid consultant email.",
    ),
    consultant_phone: text(60),
    cover_image: imageSchema,
    cover_alt: text(200),
    cover_credit: text(500),
    theme_name: text(40),
    primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    route_mode: z.enum(["automatic", "custom"]),
    arrival: text(160),
    departure: text(160),
    custom_stops: z.array(text(160).min(1)).max(40),
    days: z.array(daySchema).min(1).max(30),
    pricing: z.array(pricingSchema).max(20),
  })
  .superRefine((value, context) => {
    if (
      Number.isNaN(Date.parse(value.start_date)) ||
      new Date(value.start_date).toISOString().slice(0, 10) !== value.start_date
    )
      context.addIssue({
        code: "custom",
        path: ["start_date"],
        message: "Choose a valid date.",
      });
    if (contrastOnWhite(value.primary_color) < 4.5)
      context.addIssue({
        code: "custom",
        path: ["primary_color"],
        message: "Choose a darker primary color for readable text.",
      });
    try {
      pricingTotals(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["pricing"],
        message: (error as Error).message,
      });
    }
    value.pricing.forEach((item, index) => {
      for (const field of ["unit_price", "cost", "discount"] as const) {
        try {
          parseMoney(item[field], value.currency);
        } catch (error) {
          context.addIssue({
            code: "custom",
            path: ["pricing", index, field],
            message: (error as Error).message,
          });
        }
      }
    });
  });
export type ItineraryInput = z.infer<typeof itinerarySchema>;
export type DayInput = z.infer<typeof daySchema>;
export type PricingInput = z.infer<typeof pricingSchema>;
export type ItineraryRecord = {
  id: string;
  customer_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  traveler_count: number;
  currency: string;
  summary: string | null;
  inclusions: string | null;
  exclusions: string | null;
  notes: string | null;
  legacy_content: Record<string, unknown>;
  updated_at: string;
  share_token: string | null;
  share_expires_at: string | null;
};
export type DayRecord = {
  day_number: number;
  title: string;
  description: string | null;
  accommodation: string | null;
  meals: string | null;
  image_path: string | null;
  services: { day_details: DayInput }[];
};
export function blankDay(): DayInput {
  return {
    destination: "",
    title: "Arrival in Sri Lanka",
    description: "",
    morning: "",
    afternoon: "",
    evening: "",
    accommodation: "",
    rooms: "",
    meals: "",
    image_url: "",
    photo_alt: "",
    photo_credit: "",
    focal_x: 50,
    focal_y: 50,
    reviewed: false,
  };
}
export function blankItinerary(customer_id = ""): ItineraryInput {
  return {
    customer_id,
    title: "Your Sri Lanka journey",
    destination: "Sri Lanka",
    start_date: new Date().toISOString().slice(0, 10),
    adults: 2,
    children: 0,
    currency: "USD",
    reference: "",
    summary: "",
    arrangements: "",
    inclusions: "",
    exclusions: "",
    terms: "",
    consultant: "",
    consultant_email: "",
    consultant_phone: "",
    cover_image: "",
    cover_alt: "",
    cover_credit: "",
    theme_name: "Emerald",
    primary_color: themes[0].primary,
    accent_color: themes[0].accent,
    route_mode: "automatic",
    arrival: "Colombo",
    departure: "Colombo",
    custom_stops: [],
    days: [blankDay()],
    pricing: [],
  };
}
export function endDate(start: string, days: number) {
  const date = new Date(start + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days - 1);
  return date.toISOString().slice(0, 10);
}
export function contrastOnWhite(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0;
  const rgb = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 1.05 / (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 + 0.05);
}
export function routeStops(
  input: Pick<
    ItineraryInput,
    "route_mode" | "custom_stops" | "days" | "arrival" | "departure"
  >,
) {
  const stops = [
    input.arrival,
    ...(input.route_mode === "custom"
      ? input.custom_stops
      : input.days.map((d) => d.destination)),
    input.departure,
  ].filter(Boolean);
  return stops.filter(
    (stop, index) =>
      !index || stop.toLowerCase() !== stops[index - 1].toLowerCase(),
  );
}
export function itineraryPayload(input: ItineraryInput) {
  const {
    customer_id,
    title,
    destination,
    start_date,
    currency,
    summary,
    inclusions,
    exclusions,
    days,
    pricing,
    ...legacy
  } = input;
  return {
    header: {
      customer_id,
      title,
      destination,
      start_date,
      end_date: endDate(start_date, days.length),
      traveler_count: input.adults + input.children,
      currency,
      summary,
      inclusions,
      exclusions,
      notes: input.arrangements,
      legacy_content: {
        version: 1,
        ...legacy,
        pricing: pricing.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_minor: parseMoney(item.unit_price, currency),
          cost_minor: parseMoney(item.cost, currency),
          discount_minor: parseMoney(item.discount, currency),
          tax_rate: item.tax_rate,
          service_id: item.service_id || null,
          supplier_id: item.supplier_id || null,
        })),
      },
    },
    days: days.map((day, index) => ({
      day_number: index + 1,
      date: endDate(start_date, index + 1),
      title: day.title,
      description: day.description,
      accommodation: day.accommodation,
      meals: day.meals,
      image_path: day.image_url,
      services: [{ day_details: day }],
    })),
  };
}

export function pricingTotals(
  input: Pick<ItineraryInput, "pricing" | "currency">,
) {
  return calculateTotals(
    input.pricing.map((item) => ({
      quantity: item.quantity,
      unit_price_minor: parseMoney(item.unit_price, input.currency),
      cost_minor: parseMoney(item.cost, input.currency),
      discount_minor: parseMoney(item.discount, input.currency),
      tax_rate: item.tax_rate,
    })),
  );
}
