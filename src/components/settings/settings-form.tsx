"use client";
import { useState, useSyncExternalStore } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema, type SettingsInput } from "@/lib/settings/schema";
import { saveSettings, uploadLogo } from "@/lib/settings/actions";
import { supportedCurrencies } from "@/lib/catalog/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
const subscribe = () => () => {};
export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial,
  });
  const rates = useFieldArray({ control: form.control, name: "tax_rates" });
  const input = (key: keyof SettingsInput, label: string, large = false) => (
    <label className="flex flex-col gap-2 text-sm" key={key}>
      {label}
      {large ? (
        <textarea
          className="min-h-28 rounded-md border bg-card px-3 py-2"
          aria-invalid={!!form.formState.errors[key]}
          aria-describedby={
            form.formState.errors[key] ? `error-${key}` : undefined
          }
          {...form.register(key as Exclude<keyof SettingsInput, "tax_rates">)}
        />
      ) : (
        <Input
          aria-invalid={!!form.formState.errors[key]}
          aria-describedby={
            form.formState.errors[key] ? `error-${key}` : undefined
          }
          {...form.register(key as Exclude<keyof SettingsInput, "tax_rates">)}
        />
      )}
      <span id={`error-${key}`} className="text-xs text-destructive">
        {form.formState.errors[key]?.message as string}
      </span>
    </label>
  );
  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(async (values) =>
          setMessage(await saveSettings(values)),
        )}
        noValidate
      >
        <fieldset
          disabled={!hydrated || form.formState.isSubmitting}
          className="flex min-w-0 flex-col gap-6"
        >
          <section className="work-panel">
            <h2>Company and billing details</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {input("company_name", "Company name")}
              {input("email", "Company email")}
              {input("phone", "Phone")}
              {input("tax_id", "Tax ID")}
              {input("address", "Address", true)}
              {input("bank_details", "Bank details", true)}
              <label className="flex flex-col gap-2 text-sm">
                Default currency
                <select
                  className="h-10 rounded-md border bg-card px-3"
                  {...form.register("default_currency")}
                >
                  {supportedCurrencies.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="work-panel">
            <div className="flex items-center justify-between gap-3">
              <h2>Tax rates</h2>
              <Button
                type="button"
                variant="outline"
                onClick={() => rates.append({ name: "", rate: "0" })}
                disabled={rates.fields.length >= 20}
              >
                Add tax rate
              </Button>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              {rates.fields.map((row, index) => (
                <div className="flex flex-wrap items-end gap-3" key={row.id}>
                  <label className="flex-1 text-sm">
                    Tax name
                    <Input {...form.register(`tax_rates.${index}.name`)} />
                  </label>
                  <label className="text-sm">
                    Percentage
                    <Input
                      className="w-28"
                      inputMode="decimal"
                      {...form.register(`tax_rates.${index}.rate`)}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => rates.remove(index)}
                  >
                    Remove
                  </Button>
                  <span className="w-full text-sm text-destructive">
                    {form.formState.errors.tax_rates?.[index]?.rate?.message ||
                      form.formState.errors.tax_rates?.[index]?.name?.message}
                  </span>
                </div>
              ))}
              {!rates.fields.length && (
                <p className="text-sm text-muted-foreground">
                  Add the tax rates you use when pricing travel services.
                </p>
              )}
            </div>
          </section>
          <section className="work-panel">
            <h2>Document numbers and terms</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              {input("quotation_format", "Quotation format")}
              {input("invoice_format", "Invoice format")}
              {input("credit_format", "Credit note format")}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Use {"{year}"} and {"{sequence}"}, for example QT-{"{year}"}-
              {"{sequence}"}. Existing document numbers stay unchanged.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {input("quotation_terms", "Quotation terms", true)}
              {input("invoice_terms", "Invoice terms", true)}
            </div>
          </section>
          <section className="work-panel">
            <h2>Customer email template</h2>
            <div className="mt-5 flex flex-col gap-5">
              {input("email_subject", "Subject")}
              {input("email_body", "Message", true)}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Personalize with {"{{customer}}"}, {"{{document}}"}, {"{{total}}"}{" "}
              and {"{{due_date}}"}. Email requires a configured sender.
            </p>
          </section>
          {(message.error || message.success) && (
            <p
              role="status"
              className={message.error ? "text-destructive" : "text-primary"}
            >
              {message.error || message.success}
            </p>
          )}
          <div>
            <Button disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting
                ? "Saving…"
                : "Save company settings"}
            </Button>
          </div>
        </fieldset>
      </form>
      <form
        action={async (data) => setMessage(await uploadLogo(data))}
        className="work-panel"
      >
        <h2>Company logo</h2>
        <label className="mt-5 block text-sm">
          PNG, JPEG or WebP, up to 2 MB
          <Input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            required
            className="mt-2"
          />
        </label>
        <Button
          type="submit"
          disabled={!hydrated}
          variant="outline"
          className="mt-4"
        >
          Upload logo
        </Button>
      </form>
    </div>
  );
}
