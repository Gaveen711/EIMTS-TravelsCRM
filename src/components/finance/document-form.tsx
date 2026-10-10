"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { calculateTotals } from "@/lib/finance/schema";
import { saveQuotation, saveBooking, saveInvoice } from "@/lib/finance/actions";
import {
  supportedCurrencies,
  parseMoney,
  moneyInput,
  type Service,
} from "@/lib/catalog/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Icon } from "@/components/icon";
import {
  money,
  type FinanceKind,
  type FinanceRecord,
  type FinanceLine,
  type Choice,
} from "./types";
const uiSchema = z
  .object({
    customer_id: z.uuid("Choose a customer."),
    assigned_agent_id: z.string(),
    destination: z.string().max(500),
    start_date: z.string(),
    end_date: z.string(),
    traveler_count: z.number().int().min(1).max(10000),
    currency: z.enum(supportedCurrencies),
    exchange_rate: z
      .string()
      .regex(/^\d+(\.\d{1,8})?$/, "Enter an exchange rate.")
      .refine((v) => Number(v) > 0, "Exchange rate must be positive."),
    valid_until: z.string(),
    issue_date: z.string(),
    due_date: z.string(),
    terms: z.string().max(10000),
    notes: z.string().max(10000),
    billing_name: z.string().max(200),
    billing_email: z.string().max(254),
    billing_address: z.string().max(2000),
    items: z
      .array(
        z.object({
          service_id: z.string(),
          description: z
            .string()
            .trim()
            .min(1, "Describe this service.")
            .max(2000),
          quantity: z
            .string()
            .regex(/^\d+(\.\d{1,3})?$/, "Use up to three decimal places.")
            .refine((v) => Number(v) > 0, "Quantity must be positive."),
          price: z.string(),
          cost: z.string(),
          discount: z.string(),
          tax_rate: z
            .string()
            .regex(/^\d+(\.\d{1,4})?$/, "Enter a tax percentage.")
            .refine((v) => Number(v) <= 100, "Tax cannot exceed 100%."),
        }),
      )
      .min(1, "Add at least one service.")
      .max(100),
  })
  .superRefine((v, ctx) => {
    if (v.start_date && v.end_date && v.end_date < v.start_date)
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Return date must follow departure.",
      });
    if (v.due_date && v.issue_date && v.due_date < v.issue_date)
      ctx.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "Due date must follow issue date.",
      });
    v.items.forEach((line, i) => {
      for (const field of ["price", "cost", "discount"] as const) {
        try {
          parseMoney(line[field], v.currency);
        } catch (error) {
          ctx.addIssue({
            code: "custom",
            path: ["items", i, field],
            message: (error as Error).message,
          });
        }
      }
    });
  });
type Values = z.infer<typeof uiSchema>;
const emptyLine = {
  service_id: "",
  description: "",
  quantity: "1",
  price: "0.00",
  cost: "0.00",
  discount: "0.00",
  tax_rate: "0",
};
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";
export function DocumentForm({
  kind,
  customers,
  services,
  agents = [],
  defaults,
  record,
  items = [],
}: {
  kind: FinanceKind;
  customers: Choice[];
  services: Service[];
  agents?: Choice[];
  defaults?: { currency: string; terms: string };
  record?: FinanceRecord;
  items?: FinanceLine[];
}) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const candidate = record?.currency ?? defaults?.currency ?? "USD";
  const currency = supportedCurrencies.includes(
    candidate as (typeof supportedCurrencies)[number],
  )
    ? candidate
    : "USD";
  const form = useForm<Values>({
    resolver: zodResolver(uiSchema),
    defaultValues: {
      customer_id: record?.customer_id ?? "",
      assigned_agent_id: record?.assigned_agent_id ?? "",
      destination: record?.destination ?? "",
      start_date: record?.start_date ?? "",
      end_date: record?.end_date ?? "",
      traveler_count: record?.traveler_count ?? 1,
      currency: currency as Values["currency"],
      exchange_rate: String(record?.exchange_rate ?? 1),
      valid_until: record?.valid_until ?? "",
      issue_date: record?.issue_date ?? new Date().toISOString().slice(0, 10),
      due_date: record?.due_date ?? "",
      terms: record ? (record.terms ?? "") : (defaults?.terms ?? ""),
      notes: record?.notes ?? "",
      billing_name: record?.billing_name ?? "",
      billing_email: record?.billing_email ?? "",
      billing_address: record?.billing_address ?? "",
      items: items.length
        ? items.map((line) => ({
            service_id: line.service_id ?? "",
            description: line.description,
            quantity: String(line.quantity),
            price: moneyInput(line.unit_price_minor, currency),
            cost: moneyInput(line.cost_minor ?? 0, currency),
            discount: moneyInput(line.discount_minor, currency),
            tax_rate: String(line.tax_rate),
          }))
        : [emptyLine],
    },
  });
  const lines = useFieldArray({ control: form.control, name: "items" });
  const values = useWatch({ control: form.control });
  const selectedCurrency = values.currency ?? "USD";
  let estimated = 0;
  try {
    estimated = calculateTotals(
      (values.items ?? []).map((line) => ({
        quantity: String(line.quantity ?? "1"),
        unit_price_minor: parseMoney(line.price ?? "0", selectedCurrency),
        cost_minor: parseMoney(line.cost ?? "0", selectedCurrency),
        discount_minor: parseMoney(line.discount ?? "0", selectedCurrency),
        tax_rate: String(line.tax_rate ?? "0"),
      })),
    ).total_minor;
  } catch {
    /* Incomplete input has no preview. */
  }
  const label =
    kind === "quotations"
      ? "quotation"
      : kind === "bookings"
        ? "booking"
        : "invoice";
  const field = (
    key: Exclude<keyof Values, "items">,
    title: string,
    type = "text",
  ) => (
    <Field key={key}>
      <FieldLabel htmlFor={`document-${key}`}>{title}</FieldLabel>
      <Input
        id={`document-${key}`}
        type={type}
        aria-invalid={!!form.formState.errors[key]}
        {...form.register(
          key,
          key === "traveler_count" ? { valueAsNumber: true } : undefined,
        )}
      />
      <FieldError errors={[form.formState.errors[key]]} />
    </Field>
  );
  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit(async (input) => {
        setFeedback("");
        try {
          const customer = customers.find((c) => c.id === input.customer_id);
          const payload = {
            ...input,
            itinerary_id: record?.itinerary_id ?? "",
            booking_id: record?.booking_id ?? "",
            billing_name: input.billing_name || customer?.name || "",
            billing_email: input.billing_email || customer?.email || "",
            billing_address: input.billing_address || customer?.address || "",
            items: input.items.map((line) => ({
              service_id: line.service_id,
              description: line.description,
              quantity: line.quantity,
              unit_price_minor: parseMoney(line.price, input.currency),
              cost_minor: parseMoney(line.cost, input.currency),
              discount_minor: parseMoney(line.discount, input.currency),
              tax_rate: line.tax_rate,
            })),
          };
          const action =
            kind === "quotations"
              ? saveQuotation
              : kind === "bookings"
                ? saveBooking
                : saveInvoice;
          const result = await action(payload, record?.id);
          if (result.error) setFeedback(result.error);
          else if ("id" in result && result.id)
            router.push(`/${kind}/${result.id}`);
        } catch {
          setFeedback(
            "Unable to save. Please check the amounts and try again.",
          );
        }
      })}
    >
      <fieldset
        disabled={!hydrated || form.formState.isSubmitting}
        className="contents"
      >
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Customer and travel</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="document-customer">Customer</FieldLabel>
              <select
                id="document-customer"
                className={selectClass}
                {...form.register("customer_id")}
              >
                <option value="">Choose customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError errors={[form.formState.errors.customer_id]} />
            </Field>
            {kind === "bookings" && (
              <Field>
                <FieldLabel htmlFor="document-agent">
                  Assigned consultant
                </FieldLabel>
                <select
                  id="document-agent"
                  className={selectClass}
                  {...form.register("assigned_agent_id")}
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {field("destination", "Destination")}
            {field("traveler_count", "Travelers", "number")}
            {field("start_date", "Departure", "date")}
            {field("end_date", "Return", "date")}
            <Field>
              <FieldLabel htmlFor="document-currency">Currency</FieldLabel>
              <select
                id="document-currency"
                className={selectClass}
                {...form.register("currency")}
              >
                {supportedCurrencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            {field("exchange_rate", "Exchange rate to company currency")}
            {kind === "quotations" &&
              field("valid_until", "Valid until", "date")}
            {kind === "invoices" && (
              <>
                {field("issue_date", "Issue date", "date")}
                {field("due_date", "Due date", "date")}
                {field("billing_name", "Billing name (defaults to customer)")}
                {field("billing_email", "Billing email", "email")}
                {field("billing_address", "Billing address")}
              </>
            )}
          </div>
          {customers.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Add a customer in Customers before saving this document.
            </p>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Services and pricing</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Amounts are in {selectedCurrency}. Discount applies to the line
                before tax.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => lines.append({ ...emptyLine })}
            >
              <Icon name="plus-lg" />
              Add line
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {lines.fields.map((line, index) => (
              <fieldset key={line.id} className="rounded-lg border p-4">
                <legend className="px-2 text-sm font-medium">
                  Service {index + 1}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field className="lg:col-span-2">
                    <FieldLabel htmlFor={`catalog-${index}`}>
                      Catalog service
                    </FieldLabel>
                    <select
                      id={`catalog-${index}`}
                      className={selectClass}
                      {...form.register(`items.${index}.service_id`, {
                        onChange: (event) => {
                          const service = services.find(
                            (s) => s.id === event.target.value,
                          );
                          if (service) {
                            if (service.currency !== selectedCurrency) {
                              setFeedback(
                                `Choose a ${selectedCurrency} service or enter converted custom prices.`,
                              );
                              form.setValue(`items.${index}.service_id`, "");
                              return;
                            }
                            form.setValue(
                              `items.${index}.description`,
                              service.name,
                            );
                            form.setValue(
                              `items.${index}.price`,
                              moneyInput(
                                service.selling_minor,
                                service.currency,
                              ),
                            );
                            form.setValue(
                              `items.${index}.cost`,
                              moneyInput(service.cost_minor, service.currency),
                            );
                            form.setValue(
                              `items.${index}.tax_rate`,
                              String(service.tax_rate),
                            );
                          }
                        },
                      })}
                    >
                      <option value="">Custom service</option>
                      {services
                        .filter((s) => s.currency === selectedCurrency)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field className="lg:col-span-2">
                    <FieldLabel htmlFor={`description-${index}`}>
                      Description
                    </FieldLabel>
                    <Input
                      id={`description-${index}`}
                      {...form.register(`items.${index}.description`)}
                    />
                    <FieldError
                      errors={[
                        form.formState.errors.items?.[index]?.description,
                      ]}
                    />
                  </Field>
                  {(
                    [
                      ["quantity", "Quantity"],
                      ["price", "Unit selling price"],
                      ["cost", "Unit cost"],
                      ["discount", "Line discount"],
                      ["tax_rate", "Tax %"],
                    ] as const
                  ).map(([key, title]) => (
                    <Field key={key}>
                      <FieldLabel htmlFor={`${key}-${index}`}>
                        {title}
                      </FieldLabel>
                      <Input
                        id={`${key}-${index}`}
                        inputMode="decimal"
                        {...form.register(`items.${index}.${key}`)}
                      />
                      <FieldError
                        errors={[form.formState.errors.items?.[index]?.[key]]}
                      />
                    </Field>
                  ))}
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove service ${index + 1}`}
                      disabled={lines.fields.length === 1}
                      onClick={() => lines.remove(index)}
                    >
                      <Icon name="trash" />
                      Remove
                    </Button>
                  </div>
                </div>
              </fieldset>
            ))}
          </div>
          <FieldError errors={[form.formState.errors.items]} />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="text-sm text-muted-foreground">
              Preview · final totals are validated when saved
            </span>
            <strong className="text-xl tabular-nums">
              {money(estimated, selectedCurrency)}
            </strong>
          </div>
        </section>
        <section className="grid gap-4 rounded-xl border bg-card p-5">
          <Field>
            <FieldLabel htmlFor="document-terms">
              Terms and conditions
            </FieldLabel>
            <textarea
              id="document-terms"
              className="min-h-28 rounded-md border bg-background p-3 text-sm"
              {...form.register("terms")}
            />
            <FieldError errors={[form.formState.errors.terms]} />
          </Field>
          {kind === "bookings" && (
            <Field>
              <FieldLabel htmlFor="document-notes">Internal notes</FieldLabel>
              <textarea
                id="document-notes"
                className="min-h-24 rounded-md border p-3 text-sm"
                {...form.register("notes")}
              />
            </Field>
          )}
        </section>
        {feedback && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {feedback}
          </p>
        )}
        <div className="flex gap-3">
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : `Save ${label}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(record ? `/${kind}/${record.id}` : `/${kind}`)
            }
          >
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
