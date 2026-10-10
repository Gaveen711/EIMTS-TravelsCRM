"use server";
import { z } from "zod";
import { requireManagePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { loadDocument } from "@/components/finance/server";
import { financialPdf } from "@/lib/pdf/financial";
import { displayMoney } from "@/lib/insights/data";
import { renderEmailTemplate, emailHtml } from "./template";
export async function emailDocument(kind: unknown, id: unknown) {
  const parsed = z
    .object({ kind: z.enum(["quotations", "invoices"]), id: z.uuid() })
    .safeParse({ kind, id });
  if (!parsed.success) return { error: "Invalid document." };
  await requireManagePermission(parsed.data.kind);
  const apiKey = process.env.RESEND_API_KEY,
    sender = process.env.EMAIL_FROM;
  if (!apiKey || !sender)
    return {
      error: "Email is not configured. Download the PDF and send it manually.",
    };
  try {
    const loaded = await loadDocument(parsed.data.kind, parsed.data.id);
    if (!loaded) return { error: "Document not found." };
    const recipient = loaded.record.billing_email || loaded.customer?.email;
    if (!recipient || !z.email().safeParse(recipient).success)
      return { error: "Add a valid customer email before sending." };
    const db = await createClient();
    const { data: company, error } = await db
      .from("settings")
      .select("company_name,email_templates")
      .eq("id", 1)
      .single();
    if (error || !company)
      return { error: "Company email settings could not be loaded." };
    const values = {
      customer:
        loaded.record.billing_name || loaded.customer?.name || "Traveler",
      document: loaded.record.number || "Travel document",
      total: displayMoney(
        loaded.record.total_minor || 0,
        loaded.record.currency,
      ),
      due_date:
        loaded.record.due_date || loaded.record.valid_until || "On receipt",
    };
    const subject = renderEmailTemplate(
        company.email_templates?.document?.subject ||
          "Your travel document {{document}}",
        values,
      ),
      text = renderEmailTemplate(
        company.email_templates?.document?.body ||
          "Hello {{customer}},\n\nYour document {{document}} is attached. Total: {{total}}.\n\nThank you.",
        values,
      );
    const pdf = await financialPdf(parsed.data.kind, parsed.data.id);
    if (!pdf.ok)
      return {
        error: "The PDF could not be generated. Download it and try again.",
      };
    const bytes = Buffer.from(await pdf.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024)
      return {
        error:
          "This PDF is too large to email. Download and share it manually.",
      };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `crm-${parsed.data.kind}-${parsed.data.id}-${loaded.record.updated_at || loaded.record.created_at}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject,
        text,
        html: `<div>${emailHtml(text)}</div>`,
        attachments: [
          {
            filename: `${values.document}.pdf`,
            content: bytes.toString("base64"),
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return {
        error:
          "Email could not be delivered. Download the PDF or try again later.",
      };
    return { success: `Document email accepted for delivery to ${recipient}.` };
  } catch {
    return {
      error:
        "Email could not be delivered. Your document is saved; download the PDF or try again later.",
    };
  }
}
