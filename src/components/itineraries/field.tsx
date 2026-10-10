"use client";
import type { UseFormReturn, Path } from "react-hook-form";
import type { ItineraryInput } from "@/lib/itineraries/schema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
export function EditorField({
  form,
  name,
  label,
  multiline = false,
  type = "text",
  onChange,
}: {
  form: UseFormReturn<ItineraryInput>;
  name: Path<ItineraryInput>;
  label: string;
  multiline?: boolean;
  type?: string;
  onChange?: () => void;
}) {
  const error = form.getFieldState(name, form.formState).error;
  const registration = form.register(name, {
    valueAsNumber: type === "number",
    onChange,
  });
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {multiline ? (
        <textarea
          id={name}
          {...registration}
          aria-invalid={!!error}
          rows={3}
          className="w-full rounded-lg border bg-background p-2 text-sm"
        />
      ) : (
        <Input id={name} {...registration} aria-invalid={!!error} type={type} />
      )}
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  );
}
