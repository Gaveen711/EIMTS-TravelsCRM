import { z } from "zod";
export const leadStatuses = [
  "new",
  "contacted",
  "quoted",
  "won",
  "lost",
] as const;
const text = (max: number) => z.string().trim().max(max);
export const customerSchema = z.object({
  kind: z.enum(["individual", "company"]),
  name: text(160).min(1, "Enter a customer name."),
  email: text(254).refine(
    (v) => !v || z.email().safeParse(v).success,
    "Enter a valid email.",
  ),
  phone: text(60),
  company_name: text(160),
  address: text(1000),
  nationality: text(100),
  passport_number: text(80),
  notes: text(5000),
  tags: text(1000).refine(
    (v) =>
      v.split(",").filter((t) => t.trim()).length <= 20 &&
      v.split(",").every((t) => t.trim().length <= 40),
    "Use up to 20 tags of 40 characters.",
  ),
  lead_status: z.enum(leadStatuses),
});
export type CustomerInput = z.infer<typeof customerSchema>;
export type Customer = Omit<CustomerInput, "tags"> & {
  id: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};
export const emptyCustomer: CustomerInput = {
  kind: "individual",
  name: "",
  email: "",
  phone: "",
  company_name: "",
  address: "",
  nationality: "",
  passport_number: "",
  notes: "",
  tags: "",
  lead_status: "new",
};
export function customerRecord(value: CustomerInput) {
  return {
    ...Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, v === "" ? null : v]),
    ),
    tags: [
      ...new Set(
        value.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ],
  };
}
export const noteSchema = z
  .string()
  .trim()
  .min(1, "Enter an activity note.")
  .max(2000);
export const idSchema = z.uuid();
