import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  FinanceKind,
  FinanceRecord,
  FinanceLine,
  Choice,
  Traveler,
  Payment,
} from "./types";
export async function loadChoices(kind?: FinanceKind) {
  const db = await createClient();
  const [customers, services, profiles, settings] = await Promise.all([
    kind === "invoices"
      ? db.rpc("list_billing_customers", { p_search: "", p_limit: 500 })
      : db
          .from("customers")
          .select("id,name,email,address")
          .order("name")
          .limit(1000),
    db
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .limit(1000),
    db
      .from("profiles")
      .select("id,full_name")
      .eq("is_active", true)
      .in("role", ["admin", "agent"])
      .order("full_name")
      .limit(1000),
    db
      .from("settings")
      .select("default_currency,terms_templates")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  if (customers.error || services.error || profiles.error || settings.error)
    throw new Error("Unable to load customers and services.");
  return {
    defaults: {
      currency: String(settings.data?.default_currency ?? "USD"),
      terms: String(
        settings.data?.terms_templates?.[
          kind === "invoices" ? "invoice" : "quotation"
        ] ?? "",
      ),
    },
    customers: (customers.data ?? []) as Choice[],
    services: services.data ?? [],
    agents: (profiles.data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
    })) as Choice[],
  };
}
export async function loadDocument(kind: FinanceKind, id: string) {
  const db = await createClient();
  const fk = {
    quotations: "quotation_id",
    bookings: "booking_id",
    invoices: "invoice_id",
  }[kind];
  const itemTable = {
    quotations: "quotation_items",
    bookings: "booking_items",
    invoices: "invoice_items",
  }[kind];
  const [document, items] = await Promise.all([
    db.from(kind).select("*").eq("id", id).maybeSingle(),
    db.from(itemTable).select("*").eq(fk, id).order("sort_order"),
  ]);
  if (document.error || items.error)
    throw new Error("Unable to load this document.");
  if (!document.data) return null;
  const record = document.data as FinanceRecord;
  if (kind === "invoices" && record.document_type !== "credit_note") {
    const credits = await db
      .from("invoices")
      .select("total_minor,status")
      .eq("credited_invoice_id", id);
    if (credits.error) throw new Error("Unable to load credit notes.");
    record.credited_minor = (credits.data ?? [])
      .filter((c) => !["draft", "void"].includes(c.status))
      .reduce((sum, c) => sum + Number(c.total_minor), 0);
  }
  const customer = await db
    .from("customers")
    .select("id,name,email,address")
    .eq("id", record.customer_id)
    .maybeSingle();
  const [travelers, payments] = await Promise.all([
    kind === "bookings"
      ? db
          .from("travelers")
          .select("*")
          .eq("booking_id", id)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    kind === "invoices"
      ? db
          .from("payments")
          .select("*")
          .eq("invoice_id", id)
          .order("payment_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (travelers.error || payments.error)
    throw new Error("Unable to load travelers or payments.");
  return {
    record,
    items: (items.data ?? []) as FinanceLine[],
    customer: customer.data as Choice | null,
    travelers: (travelers.data ?? []) as Traveler[],
    payments: (payments.data ?? []) as Payment[],
  };
}

export async function creditTotals(ids: string[]) {
  const totals = new Map<string, number>();
  if (!ids.length) return totals;
  const db = await createClient();
  let offset = 0;
  while (true) {
    const result = await db
      .from("invoices")
      .select("credited_invoice_id,total_minor,status")
      .in("credited_invoice_id", ids)
      .order("id")
      .range(offset, offset + 499);
    if (result.error) throw new Error("Unable to load credit balances.");
    for (const credit of result.data ?? []) {
      if (!["draft", "void"].includes(credit.status))
        totals.set(
          credit.credited_invoice_id,
          Number(
            BigInt(totals.get(credit.credited_invoice_id) ?? 0) +
              BigInt(credit.total_minor),
          ),
        );
    }
    const length = result.data?.length ?? 0;
    if (length < 500) break;
    offset += length;
  }
  return totals;
}
