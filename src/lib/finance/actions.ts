"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireManagePermission, requireProfile } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import {
  quotationSchema,
  bookingSchema,
  invoiceSchema,
  bookingUpdateSchema,
  invoiceFromBookingSchema,
  paymentSchema,
  creditSchema,
} from "./schema";
import type { Permission } from "@/lib/auth/permissions";
async function call(
  permission: Permission,
  name: string,
  args: Record<string, unknown>,
) {
  await requireManagePermission(permission);
  try {
    const db = await createClient();
    const { data, error } = await db.rpc(name, args);
    if (error) return { error: message(error.message) };
    for (const path of [
      "/quotations",
      "/bookings",
      "/invoices",
      "/payments",
      "/dashboard",
      "/reports",
    ])
      revalidatePath(path);
    return { id: String(data), success: true };
  } catch {
    return { error: "Unable to save this change. Please try again." };
  }
}
function message(value: string) {
  const known = [
    "immutable",
    "draft",
    "locked",
    "accepted",
    "balance",
    "exceed",
    "permission",
    "issued",
    "cancelled",
    "line",
    "date",
    "credited",
    "duplicate",
  ];
  return known.some((word) => value.toLowerCase().includes(word))
    ? value
    : "Unable to save this change. Check the document and try again.";
}
function validated(schema: z.ZodType, input: unknown) {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { data: parsed.data }
    : { error: parsed.error.issues.map((i) => i.message).join(" ") };
}
export async function saveQuotation(input: unknown, id?: string) {
  await requireManagePermission("quotations");
  const v = validated(quotationSchema, input);
  if (v.error) return { error: v.error };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid quotation." };
  return call("quotations", "save_quotation", {
    p_document: v.data,
    p_id: id || null,
  });
}
export async function quotationFromItinerary(id: string) {
  await requireManagePermission("quotations");
  if (!z.uuid().safeParse(id).success) return { error: "Invalid itinerary." };
  return call("quotations", "quotation_from_itinerary", { p_id: id });
}
export async function setQuotationStatus(id: string, status: string) {
  await requireManagePermission("quotations");
  if (
    !z.uuid().safeParse(id).success ||
    !z
      .enum(["draft", "sent", "accepted", "rejected", "expired"])
      .safeParse(status).success
  )
    return { error: "Invalid status." };
  return call("quotations", "set_quotation_status", {
    p_id: id,
    p_status: status,
  });
}
export async function convertQuotation(id: string) {
  await requireManagePermission("bookings");
  if (!z.uuid().safeParse(id).success) return { error: "Invalid quotation." };
  return call("bookings", "convert_quotation", { p_id: id });
}
export async function saveBooking(input: unknown, id?: string) {
  await requireManagePermission("bookings");
  const v = validated(bookingSchema, input);
  if (v.error) return { error: v.error };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid booking." };
  return call("bookings", "save_booking", {
    p_document: v.data,
    p_id: id || null,
  });
}
export async function updateBooking(id: string, input: unknown) {
  await requireManagePermission("bookings");
  const v = validated(bookingUpdateSchema, input);
  if (v.error) return { error: v.error };
  if (!z.uuid().safeParse(id).success) return { error: "Invalid booking." };
  return call("bookings", "update_booking_details", {
    p_id: id,
    p_details: v.data,
  });
}
export async function invoiceFromBooking(id: string, input: unknown) {
  const profile = await requireProfile();
  await requireManagePermission(
    profile.role === "accountant" ? "invoices" : "bookings",
  );
  const v = validated(invoiceFromBookingSchema, input);
  if (v.error) return { error: v.error };
  if (!z.uuid().safeParse(id).success) return { error: "Invalid booking." };
  return call(
    profile.role === "accountant" ? "invoices" : "bookings",
    "invoice_from_booking",
    { p_id: id, p_options: v.data },
  );
}
export async function saveInvoice(input: unknown, id?: string) {
  await requireManagePermission("invoices");
  const v = validated(invoiceSchema, input);
  if (v.error) return { error: v.error };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid invoice." };
  return call("invoices", "save_invoice", {
    p_document: v.data,
    p_id: id || null,
  });
}
export async function setInvoiceStatus(id: string, status: string) {
  await requireManagePermission("invoices");
  if (
    !z.uuid().safeParse(id).success ||
    !z.enum(["sent", "void"]).safeParse(status).success
  )
    return { error: "Invalid status." };
  return call("invoices", "set_invoice_status", { p_id: id, p_status: status });
}
export async function recordPayment(input: unknown) {
  await requireManagePermission("payments");
  const v = validated(paymentSchema, input);
  if (v.error) return { error: v.error };
  return call("payments", "add_payment", { p_payment: v.data });
}
export async function creditInvoice(id: string, input: unknown) {
  await requireManagePermission("invoices");
  const v = validated(creditSchema, input);
  if (v.error) return { error: v.error };
  if (!z.uuid().safeParse(id).success) return { error: "Invalid invoice." };
  return call("invoices", "credit_invoice", { p_id: id, p_options: v.data });
}
