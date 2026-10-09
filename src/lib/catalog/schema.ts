import { z } from "zod";
export const supplierKinds = ["hotel", "transport", "tour", "airline", "vendor"] as const;
const text = z.string().trim().max(2000);
const email = z.string().trim().max(254).refine(v => !v || z.email().safeParse(v).success, "Enter a valid email address.");
export const supplierSchema = z.object({name: z.string().trim().min(1, "Name is required.").max(160), kind: z.enum(supplierKinds), email, phone: z.string().trim().max(60), contact_name: z.string().trim().max(160), address: z.string().trim().max(1000), payment_terms: text, notes: z.string().trim().max(5000)});
export const supportedCurrencies = ["USD", "LKR", "EUR", "GBP", "AUD", "CAD", "INR", "SGD", "AED", "JPY", "KRW", "KWD", "BHD", "OMR"] as const;
export function currencyExponent(currency: string) { if (!supportedCurrencies.includes(currency as typeof supportedCurrencies[number])) throw new Error("Unsupported currency."); return ["JPY", "KRW"].includes(currency) ? 0 : ["KWD", "BHD", "OMR"].includes(currency) ? 3 : 2; }
export function parseMoney(value: string, currency: string): number {
  const exponent = currencyExponent(currency); const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > exponent) throw new Error(`Use a positive amount with up to ${exponent} decimal places.`);
  const minor = BigInt(match[1]) * BigInt(10 ** exponent) + BigInt((match[2] ?? "").padEnd(exponent, "0") || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large.");
  return Number(minor);
}
export function moneyInput(minor: number, currency: string) { if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Invalid stored amount."); const exponent = currencyExponent(currency); const digits = String(minor).padStart(exponent + 1, "0"); return exponent ? `${digits.slice(0,-exponent)}.${digits.slice(-exponent)}` : digits; }
export const serviceSchema = z.object({name: z.string().trim().min(1,"Name is required.").max(160), description:z.string().trim().max(5000), category:z.enum(supplierKinds), supplier_id:z.union([z.uuid(),z.literal("")]), currency:z.enum(supportedCurrencies), cost:text.min(1), selling:text.min(1), tax_rate:z.string().trim().regex(/^\d+(\.\d{1,4})?$/, "Enter a tax percentage with up to four decimals.").refine(v=>Number(v)<=100,"Tax must be between 0 and 100."), is_active:z.boolean()}).superRefine((v,ctx)=>{ for (const field of ["cost","selling"] as const) { try { parseMoney(v[field],v.currency); } catch(e) { ctx.addIssue({code:"custom",path:[field],message:(e as Error).message}); } } });
export type SupplierInput = z.infer<typeof supplierSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type Supplier = SupplierInput & {id:string};
export type Service = Omit<ServiceInput,"cost"|"selling"> & {id:string;cost_minor:number;selling_minor:number};
export function servicePayload(input: ServiceInput) { const {cost,selling,supplier_id,...rest}=input; return {...rest,supplier_id:supplier_id||null,cost_minor:parseMoney(cost,input.currency),selling_minor:parseMoney(selling,input.currency),tax_rate:input.tax_rate}; }

export function supplierPayload(input: SupplierInput) { return {...input,email:input.email||null,phone:input.phone||null,contact_name:input.contact_name||null,address:input.address||null,payment_terms:input.payment_terms||null,notes:input.notes||null}; }
