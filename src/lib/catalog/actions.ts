"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireManagePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import {
  supplierSchema,
  supplierPayload,
  serviceSchema,
  servicePayload,
} from "./schema";
export async function saveCatalog(
  kind: "suppliers" | "services",
  input: unknown,
  id?: string,
) {
  const table = z.enum(["suppliers", "services"]).parse(kind);
  await requireManagePermission(table);
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid record identifier." };
  const parsed =
    table === "suppliers"
      ? supplierSchema.safeParse(input)
      : serviceSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  const payload: Record<string, unknown> =
    table === "suppliers"
      ? supplierPayload(supplierSchema.parse(parsed.data))
      : servicePayload(serviceSchema.parse(parsed.data));
  try {
    const db = await createClient();
    const query = id
      ? db.from(table).update(payload).eq("id", id)
      : db.from(table).insert(payload);
    const { data, error } = await query.select("id").single();
    if (error || !data)
      return {
        error:
          error?.code === "23503"
            ? "The selected supplier no longer exists. Refresh and choose another."
            : "Unable to save this record. Try again.",
      };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
  revalidatePath(`/${table}`);
  return { success: true };
}
export async function deleteSupplier(id: string) {
  await requireManagePermission("suppliers");
  if (!z.uuid().safeParse(id).success)
    return { error: "Invalid record identifier." };
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("suppliers")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error || !data)
      return {
        error: ["23503", "23001"].includes(error?.code ?? "")
          ? "This supplier is linked to services or bookings. Keep it for their history."
          : "Unable to delete supplier.",
      };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
  revalidatePath("/suppliers");
  return { success: true };
}
