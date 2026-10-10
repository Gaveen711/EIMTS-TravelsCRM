"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  customerSchema,
  emptyCustomer,
  leadStatuses,
  type CustomerInput,
} from "@/lib/customers/schema";
import {
  saveCustomer,
  addCustomerNote,
  importCustomers,
  type CustomerResult,
} from "@/lib/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
const labels: Record<keyof CustomerInput, string> = {
  kind: "Customer type",
  name: "Customer name",
  email: "Email",
  phone: "Phone",
  company_name: "Company name",
  address: "Address",
  nationality: "Nationality",
  passport_number: "Passport number (optional)",
  notes: "Notes",
  tags: "Tags (comma separated)",
  lead_status: "Lead status",
};
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export function CustomerForm({
  initial = emptyCustomer,
  id,
}: {
  initial?: CustomerInput;
  id?: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<CustomerResult>({});
  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: initial,
  });
  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback({});
        const result = await saveCustomer(values, id);
        setFeedback(result);
        if (result.id) router.push(`/customers/${result.id}`);
      })}
    >
      {(Object.keys(labels) as (keyof CustomerInput)[]).map((key) => (
        <Field
          key={key}
          className={
            key === "notes" || key === "address" ? "sm:col-span-2" : ""
          }
        >
          <FieldLabel htmlFor={`customer-${key}`}>{labels[key]}</FieldLabel>
          {key === "kind" || key === "lead_status" ? (
            <select
              id={`customer-${key}`}
              className={selectClass}
              {...form.register(key)}
            >
              {(key === "kind" ? ["individual", "company"] : leadStatuses).map(
                (value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ),
              )}
            </select>
          ) : key === "notes" || key === "address" ? (
            <textarea
              id={`customer-${key}`}
              className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
              aria-invalid={!!form.formState.errors[key]}
              {...form.register(key)}
            />
          ) : (
            <Input
              id={`customer-${key}`}
              type={key === "email" ? "email" : "text"}
              aria-invalid={!!form.formState.errors[key]}
              {...form.register(key)}
            />
          )}
          <FieldError errors={[form.formState.errors[key]]} />
        </Field>
      ))}
      {feedback.error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {feedback.error}
        </p>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <Button disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save customer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(id ? `/customers/${id}` : "/customers")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function ActivityForm({ id }: { id: string }) {
  const [feedback, setFeedback] = useState<CustomerResult>({});
  const [pending, start] = useTransition();
  return (
    <form
      action={(form) =>
        start(async () => {
          setFeedback(await addCustomerNote(id, form.get("summary")));
        })
      }
      className="flex flex-col gap-3"
    >
      <label htmlFor="activity-note" className="text-sm font-medium">
        Add activity note
      </label>
      <textarea
        id="activity-note"
        name="summary"
        required
        maxLength={2000}
        className="min-h-24 rounded-md border p-3"
      />
      <Button disabled={pending}>{pending ? "Saving…" : "Add note"}</Button>
      {(feedback.error || feedback.success) && (
        <p role="status" className="text-sm">
          {feedback.error || feedback.success}
        </p>
      )}
    </form>
  );
}
export function CustomerImport() {
  const [feedback, setFeedback] = useState<CustomerResult>({});
  const [pending, start] = useTransition();
  return (
    <details className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer font-medium">
        Import customers from CSV
      </summary>
      <p className="my-3 text-sm text-muted-foreground">
        Up to 200 rows / 256 KB. Download the export template below. Imported
        rows create new customers; existing records are retained.
      </p>
      <a
        download
        href="/customers/export?template=1"
        className="text-sm underline"
      >
        Download CSV template
      </a>
      <form
        className="mt-4 flex flex-wrap items-center gap-3"
        action={(form) =>
          start(async () => setFeedback(await importCustomers(form)))
        }
      >
        <Input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          aria-label="Customer CSV"
          className="max-w-sm"
        />
        <Button disabled={pending}>
          {pending ? "Importing…" : "Import CSV"}
        </Button>
      </form>
      {(feedback.error || feedback.success) && (
        <p role="status" className="mt-3 text-sm">
          {feedback.error || feedback.success}
        </p>
      )}
    </details>
  );
}
