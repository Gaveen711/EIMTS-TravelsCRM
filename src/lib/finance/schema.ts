import { z } from "zod";
import { supportedCurrencies } from "@/lib/catalog/schema";
const optionalId = z.union([z.uuid(), z.literal("")]).optional();
const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
        new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v),
    "Enter a valid date.",
  )
  .optional();
const text = (max = 5000) => z.string().trim().max(max).default("");
export const minor = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const decimal = (places: number, maximum: number) =>
  z
    .string()
    .regex(new RegExp("^\\d+(?:\\.\\d{1," + places + "})?$"))
    .refine((v) => Number(v) <= maximum);
export const lineSchema = z
  .object({
    description: z.string().trim().min(1).max(2000),
    service_id: optionalId,
    quantity: decimal(3, 999999999).refine((v) => Number(v) > 0),
    unit_price_minor: minor,
    cost_minor: minor.default(0),
    discount_minor: minor.default(0),
    tax_rate: decimal(4, 100).default("0"),
  })
  .superRefine((v, c) => {
    try {
      calculateTotals([v]);
    } catch (e) {
      c.addIssue({ code: "custom", message: (e as Error).message });
    }
  });
export const documentSchema = z
  .object({
    customer_id: z.uuid(),
    itinerary_id: optionalId,
    start_date: date,
    end_date: date,
    traveler_count: z.number().int().min(1).max(10000).default(1),
    destination: text(500),
    currency: z.enum(supportedCurrencies),
    exchange_rate: decimal(8, 999999999)
      .refine((v) => Number(v) > 0)
      .default("1"),
    valid_until: date,
    terms: text(20000),
    items: z.array(lineSchema).min(1).max(100),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "End date must follow start date.",
  });
export const quotationSchema = documentSchema;
export const bookingSchema = documentSchema.extend({
  assigned_agent_id: optionalId,
  notes: text(10000),
});
export const invoiceSchema = documentSchema
  .extend({
    booking_id: optionalId,
    issue_date: date.default(() => new Date().toISOString().slice(0, 10)),
    due_date: date,
    billing_name: z.string().trim().min(1).max(160),
    billing_email: text(254).refine(
      (v) => !v || z.email().safeParse(v).success,
    ),
    billing_address: text(2000),
  })
  .refine(
    (v) =>
      !v.issue_date ||
      !v.due_date ||
      v.due_date >= (v.issue_date || new Date().toISOString().slice(0, 10)),
    { path: ["due_date"], message: "Due date must follow issue date." },
  );
export const travelerSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  date_of_birth: date,
  nationality: text(80),
  passport_number: text(80),
  passport_expiry: date,
  notes: text(5000),
});
export const bookingUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
  notes: text(10000),
  travelers: z.array(travelerSchema).max(10000),
  confirmations: z
    .array(
      z.object({
        id: z.uuid(),
        confirmation_status: z.enum([
          "pending",
          "requested",
          "confirmed",
          "cancelled",
        ]),
        confirmation_number: text(160),
      }),
    )
    .max(100),
});
export const invoiceFromBookingSchema = z
  .object({
    billing_type: z.enum(["deposit", "partial", "balance"]),
    amount_minor: minor.optional(),
    issue_date: date.default(() => new Date().toISOString().slice(0, 10)),
    due_date: date,
    terms: text(20000),
  })
  .refine(
    (v) =>
      !v.due_date ||
      v.due_date >= (v.issue_date || new Date().toISOString().slice(0, 10)),
    { path: ["due_date"], message: "Due date must follow issue date." },
  )
  .refine((v) => v.billing_type === "balance" || !!v.amount_minor, {
    path: ["amount_minor"],
    message: "Enter a positive amount.",
  });
export const paymentSchema = z.object({
  invoice_id: z.uuid(),
  amount_minor: minor.refine((v) => v > 0),
  payment_date: date,
  method: z.enum(["cash", "bank_transfer", "card", "other"]),
  reference: text(200),
  notes: text(5000),
});
export const creditSchema = z.object({
  amount_minor: minor.refine((v) => v > 0),
  reason: z.string().trim().min(1).max(2000),
  issue_date: date,
});
export type FinanceLine = z.infer<typeof lineSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
function scaled(value: string, places: number) {
  if (!new RegExp("^\\d+(?:\\.\\d{1," + places + "})?$").test(value))
    throw new Error("Invalid decimal precision.");
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * BigInt(10) ** BigInt(places) +
    BigInt(fraction.padEnd(places, "0") || "0")
  );
}
function rounded(n: bigint, d: bigint) {
  return (n + d / BigInt(2)) / d;
}
function safe(n: bigint) {
  if (n < BigInt(0) || n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Document amount exceeds the supported range.");
  return Number(n);
}
export function calculateTotals(
  items: Pick<
    FinanceLine,
    | "quantity"
    | "unit_price_minor"
    | "cost_minor"
    | "discount_minor"
    | "tax_rate"
  >[],
) {
  let subtotal = BigInt(0),
    discount = BigInt(0),
    tax = BigInt(0),
    cost = BigInt(0);
  const lines = items.map((item) => {
    const q = scaled(item.quantity, 3);
    const gross = rounded(q * BigInt(item.unit_price_minor), BigInt(1000));
    const d = BigInt(item.discount_minor);
    if (q <= BigInt(0)) throw new Error("Quantity must be positive.");
    if (scaled(item.tax_rate, 4) > BigInt(1000000))
      throw new Error("Tax exceeds 100%.");
    if (d > gross) throw new Error("Discount exceeds the line subtotal.");
    const t = rounded((gross - d) * scaled(item.tax_rate, 4), BigInt(1000000));
    subtotal += gross;
    discount += d;
    tax += t;
    cost += rounded(q * BigInt(item.cost_minor), BigInt(1000));
    return {
      ...item,
      subtotal_minor: safe(gross),
      tax_minor: safe(t),
      total_minor: safe(gross - d + t),
    };
  });
  return {
    subtotal_minor: safe(subtotal),
    discount_minor: safe(discount),
    tax_minor: safe(tax),
    total_minor: safe(subtotal - discount + tax),
    cost_minor: safe(cost),
    lines,
  };
}
export function formatDocumentNumber(
  kind: "quotation" | "invoice" | "credit_note",
  year: number,
  sequence: number,
) {
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 9999 ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1
  )
    throw new Error("Invalid document number.");
  return `${kind === "quotation" ? "QT" : kind === "invoice" ? "INV" : "CN"}-${year}-${String(sequence).padStart(4, "0")}`;
}
