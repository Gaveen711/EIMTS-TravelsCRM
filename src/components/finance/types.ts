export type FinanceKind = "quotations" | "bookings" | "invoices";
export type FinanceLine = {
  id?: string;
  service_id?: string | null;
  description: string;
  quantity: string | number;
  unit_price_minor: number;
  cost_minor?: number;
  discount_minor: number;
  tax_rate: string | number;
  tax_minor?: number;
  total_minor: number;
  confirmation_status?: string;
  confirmation_number?: string | null;
};
export type FinanceRecord = {
  id: string;
  number?: string;
  customer_id: string;
  itinerary_id?: string | null;
  quotation_id?: string | null;
  booking_id?: string | null;
  credited_invoice_id?: string | null;
  document_type?: string;
  billing_type?: string;
  destination?: string;
  start_date?: string | null;
  end_date?: string | null;
  traveler_count?: number;
  currency: string;
  exchange_rate: string | number;
  status: string;
  subtotal_minor?: number;
  discount_minor?: number;
  tax_minor?: number;
  total_minor?: number;
  cost_minor?: number;
  selling_minor?: number;
  paid_minor?: number;
  credited_minor?: number;
  valid_until?: string | null;
  issue_date?: string;
  due_date?: string | null;
  billing_name?: string;
  billing_email?: string | null;
  billing_address?: string | null;
  terms?: string | null;
  notes?: string | null;
  assigned_agent_id?: string | null;
  created_at: string;
  updated_at?: string;
};
export type Choice = {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
};
export type Traveler = {
  id?: string;
  full_name: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  passport_number?: string | null;
  passport_expiry?: string | null;
  notes?: string | null;
};
export type Payment = {
  id: string;
  invoice_id: string;
  amount_minor: number;
  payment_date: string;
  method: string;
  reference?: string;
};
export const titles = {
  quotations: "Quotations",
  bookings: "Bookings",
  invoices: "Invoices",
};
const integerFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 0,
});
const currencyFormatters = new Map<string, Intl.NumberFormat>();
export function money(minor: number | undefined, currency: string) {
  const amount = BigInt(minor ?? 0),
    negative = amount < BigInt(0),
    absolute = negative ? -amount : amount;
  const exponent = ["JPY", "KRW"].includes(currency)
    ? 0
    : ["KWD", "BHD", "OMR"].includes(currency)
      ? 3
      : 2;
  const scale = BigInt(10) ** BigInt(exponent),
    integer = integerFormatter.format(absolute / scale);
  const fraction = String(absolute % scale).padStart(exponent, "0");
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter
    .formatToParts(negative ? -0 : 0)
    .map((part) =>
      part.type === "integer"
        ? integer
        : part.type === "fraction"
          ? fraction
          : part.value,
    )
    .join("");
}
export function outstanding(record: FinanceRecord) {
  if (record.status === "void" || record.document_type === "credit_note")
    return 0;
  const balance =
    BigInt(record.total_minor ?? 0) -
    BigInt(record.paid_minor ?? 0) -
    BigInt(record.credited_minor ?? 0);
  return Number(balance > BigInt(0) ? balance : BigInt(0));
}
export function refundDue(record: FinanceRecord) {
  const balance =
    BigInt(record.paid_minor ?? 0) +
    BigInt(record.credited_minor ?? 0) -
    BigInt(record.total_minor ?? 0);
  return Number(balance > BigInt(0) ? balance : BigInt(0));
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
