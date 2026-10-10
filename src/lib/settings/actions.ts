"use server";
import { revalidatePath } from "next/cache";
import { requireManagePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "./schema";
export async function saveSettings(input: unknown) {
  await requireManagePermission("settings");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    const db = await createClient();
    const { error } = await db
      .from("settings")
      .update({
        company_name: v.company_name,
        email: v.email || null,
        phone: v.phone || null,
        address: v.address || null,
        tax_id: v.tax_id || null,
        bank_details: v.bank_details || null,
        default_currency: v.default_currency,
        tax_rates: v.tax_rates,
        numbering_formats: {
          quotation: v.quotation_format,
          invoice: v.invoice_format,
          credit_note: v.credit_format,
        },
        terms_templates: {
          quotation: v.quotation_terms,
          invoice: v.invoice_terms,
        },
        email_templates: {
          document: { subject: v.email_subject, body: v.email_body },
        },
      })
      .eq("id", 1)
      .select("id")
      .single();
    if (error)
      return { error: "Company settings could not be saved. Try again." };
    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    return { success: "Company settings saved." };
  } catch {
    return { error: "Unable to connect to the workspace." };
  }
}

export async function uploadLogo(form: FormData) {
  await requireManagePermission("settings");
  const file = form.get("logo");
  if (!(file instanceof File) || file.size > 2097152 || file.size < 12)
    return { error: "Choose a PNG, JPEG or WebP logo up to 2 MB." };
  const { logoMime, storeDevelopmentLogo } = await import("./logo");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    mime = logoMime(bytes);
  if (!mime || mime !== file.type)
    return { error: "The uploaded file is not a supported image." };
  try {
    const db = await createClient();
    const { developmentWorkspace } = await import("@/lib/development/config");
    let logoPath: string;
    if (developmentWorkspace()) logoPath = await storeDevelopmentLogo(bytes);
    else {
      logoPath = `company/${crypto.randomUUID()}.${mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp"}`;
      const { error } = await db.storage
        .from("company-logos")
        .upload(logoPath, bytes, { contentType: mime });
      if (error) return { error: "Logo upload failed. Please try again." };
    }
    const { error } = await db
      .from("settings")
      .update({ logo_path: logoPath })
      .eq("id", 1)
      .select("id")
      .single();
    if (error)
      return { error: "The logo could not be linked to your company." };
    revalidatePath("/", "layout");
    return { success: "Company logo uploaded." };
  } catch {
    return { error: "Logo upload failed. Please try again." };
  }
}
