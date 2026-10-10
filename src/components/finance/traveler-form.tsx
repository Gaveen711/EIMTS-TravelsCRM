"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import type { Traveler } from "./types";
const travelerSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the traveler name.").max(200),
  date_of_birth: z.string(),
  nationality: z.string().max(100),
  passport_number: z.string().max(100),
  passport_expiry: z.string(),
  notes: z.string().max(2000),
});
export function TravelerForm({
  travelers,
  onSave,
  disabled,
}: {
  travelers: Traveler[];
  onSave: (next: z.infer<typeof travelerSchema>[]) => Promise<boolean>;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const form = useForm<z.infer<typeof travelerSchema>>({
    resolver: zodResolver(travelerSchema),
    defaultValues: {
      full_name: "",
      date_of_birth: "",
      nationality: "",
      passport_number: "",
      passport_expiry: "",
      notes: "",
    },
  });
  const normalized = travelers.map((t) => ({
    full_name: t.full_name,
    date_of_birth: t.date_of_birth ?? "",
    nationality: t.nationality ?? "",
    passport_number: t.passport_number ?? "",
    passport_expiry: t.passport_expiry ?? "",
    notes: t.notes ?? "",
  }));
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Travelers</h2>
      <ul className="mt-3 divide-y">
        {travelers.map((t, i) => (
          <li
            key={t.id ?? i}
            className="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <strong>{t.full_name}</strong>
              <p className="text-muted-foreground">
                {[t.nationality, t.passport_number]
                  .filter(Boolean)
                  .join(" · ") || "Contact details pending"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  setEditing(i);
                  form.reset(normalized[i]);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                aria-label={`Remove traveler ${t.full_name}`}
                onClick={() =>
                  onSave(normalized.filter((_, index) => index !== i))
                }
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <form
        noValidate
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={form.handleSubmit(async (values) => {
          const next =
            editing === null
              ? [...normalized, values]
              : normalized.map((t, i) => (i === editing ? values : t));
          if (await onSave(next)) {
            setEditing(null);
            form.reset({
              full_name: "",
              date_of_birth: "",
              nationality: "",
              passport_number: "",
              passport_expiry: "",
              notes: "",
            });
          }
        })}
      >
        {(
          [
            ["full_name", "Traveler name"],
            ["date_of_birth", "Date of birth"],
            ["nationality", "Nationality"],
            ["passport_number", "Passport number"],
            ["passport_expiry", "Passport expiry"],
            ["notes", "Traveler notes"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key}>
            <FieldLabel htmlFor={`traveler-${key}`}>{label}</FieldLabel>
            <Input
              id={`traveler-${key}`}
              aria-invalid={!!form.formState.errors[key]}
              type={
                key === "date_of_birth" || key === "passport_expiry"
                  ? "date"
                  : "text"
              }
              {...form.register(key)}
            />
            <FieldError errors={[form.formState.errors[key]]} />
          </Field>
        ))}
        <Button className="self-end" disabled={disabled}>
          {editing === null ? "Add traveler" : "Save traveler"}
        </Button>
      </form>
    </section>
  );
}
