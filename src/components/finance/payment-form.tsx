"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { parseMoney, moneyInput } from "@/lib/catalog/schema";
import { outstanding, statusLabel, type FinanceRecord } from "./types";
const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";
const paymentSchema = z.object({
  amount: z.string().min(1, "Enter a payment amount."),
  payment_date: z.string().min(1, "Choose a payment date."),
  method: z.enum(["cash", "bank_transfer", "card", "other"]),
  reference: z.string().max(200),
  notes: z.string().max(2000),
});
export function PaymentForm({
  record,
  onSave,
  disabled,
}: {
  record: FinanceRecord;
  onSave: (input: unknown) => Promise<boolean>;
  disabled: boolean;
}) {
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: moneyInput(outstanding(record), record.currency),
      payment_date: new Date().toISOString().slice(0, 10),
      method: "bank_transfer",
      reference: "",
      notes: "",
    },
  });
  return (
    <form
      noValidate
      className="grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const amount_minor = parseMoney(values.amount, record.currency);
          if (amount_minor <= 0 || amount_minor > outstanding(record)) {
            form.setError("amount", {
              message:
                amount_minor <= 0
                  ? "Enter an amount greater than zero."
                  : "Payment cannot exceed the outstanding balance.",
            });
            return;
          }
          await onSave({
            ...values,
            invoice_id: record.id,
            amount_minor,
          });
        } catch {
          form.setError("amount", { message: "Enter a valid amount." });
        }
      })}
    >
      <h2 className="text-lg font-semibold sm:col-span-2 lg:col-span-3">
        Record payment
      </h2>
      <Field>
        <FieldLabel htmlFor="payment-amount">
          Payment amount ({record.currency})
        </FieldLabel>
        <Input
          id="payment-amount"
          inputMode="decimal"
          aria-invalid={!!form.formState.errors.amount}
          aria-describedby={
            form.formState.errors.amount ? "payment-amount-error" : undefined
          }
          {...form.register("amount")}
        />
        <FieldError
          id="payment-amount-error"
          errors={[form.formState.errors.amount]}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="payment-date">Payment date</FieldLabel>
        <Input
          id="payment-date"
          type="date"
          {...form.register("payment_date")}
        />
        <FieldError errors={[form.formState.errors.payment_date]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="payment-method">Payment method</FieldLabel>
        <select
          id="payment-method"
          className={selectClass}
          {...form.register("method")}
        >
          {["cash", "bank_transfer", "card", "other"].map((method) => (
            <option key={method} value={method}>
              {statusLabel(method)}
            </option>
          ))}
        </select>
        <FieldError errors={[form.formState.errors.method]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="payment-reference">Payment reference</FieldLabel>
        <Input id="payment-reference" {...form.register("reference")} />
        <FieldError errors={[form.formState.errors.reference]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="payment-notes">Payment notes</FieldLabel>
        <Input id="payment-notes" {...form.register("notes")} />
        <FieldError errors={[form.formState.errors.notes]} />
      </Field>
      <Button disabled={disabled} className="self-end">
        Record payment
      </Button>
    </form>
  );
}
