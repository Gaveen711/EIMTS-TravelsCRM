import { requirePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";
import type { SettingsInput } from "@/lib/settings/schema";
export default async function Settings() {
  await requirePermission("settings");
  const db = await createClient();
  const { data, error } = await db
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error("Company settings could not be loaded.");
  const initial: SettingsInput = {
    company_name: data.company_name,
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    tax_id: data.tax_id || "",
    bank_details: data.bank_details || "",
    default_currency: data.default_currency,
    quotation_terms: data.terms_templates?.quotation || "",
    invoice_terms: data.terms_templates?.invoice || "",
    email_subject:
      data.email_templates?.document?.subject ||
      "Your travel document {{document}}",
    email_body:
      data.email_templates?.document?.body ||
      "Hello {{customer}},\n\nPlease find your document {{document}} attached. Total: {{total}}.\n\nThank you for traveling with us.",
    tax_rates: (data.tax_rates || []).map(
      (row: { name: string; rate: string | number }) => ({
        name: row.name,
        rate: String(row.rate),
      }),
    ),
    quotation_format:
      data.numbering_formats?.quotation || "QT-{year}-{sequence}",
    invoice_format: data.numbering_formats?.invoice || "INV-{year}-{sequence}",
    credit_format:
      data.numbering_formats?.credit_note || "CN-{year}-{sequence}",
  };
  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="page-title">Company settings</h1>
        <p className="mt-2 text-muted-foreground">
          Keep your branding, billing details and document defaults in one
          place.
        </p>
      </header>
      <SettingsForm initial={initial} />
    </div>
  );
}
