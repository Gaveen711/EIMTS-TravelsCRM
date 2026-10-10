import { z } from "zod";
import { supportedCurrencies } from "@/lib/catalog/schema";
const format = z
  .string()
  .max(80)
  .regex(
    /^[A-Za-z0-9-]*\{year\}[A-Za-z0-9-]*\{sequence\}$/,
    "Use a prefix followed by {year} and {sequence}.",
  );
export const settingsSchema = z
  .object({
    company_name: z.string().trim().min(1, "Enter your company name.").max(160),
    email: z.union([z.email(), z.literal("")]),
    phone: z.string().max(80),
    address: z.string().max(2000),
    tax_id: z.string().max(160),
    bank_details: z.string().max(4000),
    default_currency: z.enum(supportedCurrencies),
    quotation_terms: z.string().max(10000),
    invoice_terms: z.string().max(10000),
    email_subject: z.string().max(200),
    email_body: z.string().max(10000),
    tax_rates: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          rate: z
            .string()
            .regex(
              /^\d{1,3}(\.\d{1,4})?$/,
              "Enter a percentage with up to four decimal places.",
            )
            .refine(
              (value) => Number(value) <= 100,
              "Tax must be between 0 and 100.",
            ),
        }),
      )
      .max(20),
    quotation_format: format,
    invoice_format: format,
    credit_format: format,
  })
  .refine((value) => value.invoice_format !== value.credit_format, {
    path: ["credit_format"],
    message: "Invoice and credit note formats must be different.",
  });
export type SettingsInput = z.infer<typeof settingsSchema>;
