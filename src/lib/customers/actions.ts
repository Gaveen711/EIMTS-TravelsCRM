"use server";
import { revalidatePath } from "next/cache";
import { requireManagePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { customerSchema, customerRecord, idSchema, noteSchema } from "./schema";
import { importCsv } from "./csv";
export type CustomerResult = { error?: string; id?: string; success?: string };
export async function saveCustomer(
  input: unknown,
  id?: string,
): Promise<CustomerResult> {
  await requireManagePermission("customers");
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (id && !idSchema.safeParse(id).success)
    return { error: "Invalid customer." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("save_customer", {
      p_customer: customerRecord(parsed.data),
      p_id: id ?? null,
    });
    if (error)
      return { error: "Customer could not be saved. Please try again." };
    revalidatePath("/customers");
    if (id) revalidatePath(`/customers/${id}`);
    return { id: data as string };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
}
export async function addCustomerNote(
  id: string,
  input: unknown,
): Promise<CustomerResult> {
  await requireManagePermission("customers");
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(id).success)
    return { error: "Enter a valid note and customer." };
  try {
    const client = await createClient();
    const { error } = await client.rpc("add_customer_note", {
      p_customer_id: id,
      p_summary: parsed.data,
    });
    if (error) return { error: "Note could not be saved." };
    revalidatePath(`/customers/${id}`);
    return { success: "Activity note saved." };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
}
export async function importCustomers(form: FormData): Promise<CustomerResult> {
  await requireManagePermission("customers");
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 262144)
    return { error: "Choose a CSV file up to 256 KB." };
  let rows;
  try {
    rows = importCsv(await file.text());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid CSV." };
  }
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("import_customers", {
      p_rows: rows,
    });
    if (error)
      return {
        error:
          "Import failed; no customers were added. Check your file and try again.",
      };
    revalidatePath("/customers");
    return { success: `Imported ${data} customers.` };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
}
