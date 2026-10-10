"use client";
import type { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import type { ItineraryInput } from "@/lib/itineraries/schema";
import type { Service } from "@/lib/catalog/schema";
import { moneyInput } from "@/lib/catalog/schema";
import { Button } from "@/components/ui/button";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { EditorField } from "./field";
export function PricingEditor({
  form,
  pricing,
  services,
}: {
  form: UseFormReturn<ItineraryInput>;
  pricing: UseFieldArrayReturn<ItineraryInput, "pricing">;
  services: Service[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Amounts use the selected currency. Traveler count does not change line
        quantity.
      </p>
      <Field>
        <FieldLabel htmlFor="catalog-price">
          Add from services catalog
        </FieldLabel>
        <select
          id="catalog-price"
          defaultValue=""
          className="rounded-lg border bg-background p-2"
          onChange={(event) => {
            const service = services.find((s) => s.id === event.target.value);
            if (service && pricing.fields.length < 20) {
              if (service.currency !== form.getValues("currency"))
                window.alert(
                  "Choose " + service.currency + " before adding this service.",
                );
              else
                pricing.append({
                  description: service.name,
                  quantity: "1",
                  unit_price: moneyInput(
                    service.selling_minor,
                    service.currency,
                  ),
                  cost: moneyInput(service.cost_minor, service.currency),
                  discount: "0",
                  tax_rate: String(service.tax_rate),
                  service_id: service.id,
                  supplier_id: service.supplier_id || "",
                });
            }
            event.target.value = "";
          }}
        >
          <option value="">Choose a service…</option>
          {services.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name} ({s.currency})
            </option>
          ))}
        </select>
      </Field>
      {pricing.fields.map((item, index) => (
        <section key={item.id} className="rounded-xl border p-4">
          <div className="mb-3 flex justify-between">
            <h3 className="font-semibold">Price line {index + 1}</h3>
            <Button
              variant="destructive"
              type="button"
              onClick={() => pricing.remove(index)}
            >
              Remove
            </Button>
          </div>
          <FieldGroup>
            <EditorField
              form={form}
              name={`pricing.${index}.description`}
              label="Description"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  "quantity",
                  "unit_price",
                  "cost",
                  "discount",
                  "tax_rate",
                ] as const
              ).map((name) => (
                <EditorField
                  key={name}
                  form={form}
                  name={`pricing.${index}.${name}`}
                  label={
                    {
                      quantity: "Quantity",
                      unit_price: "Unit selling price",
                      cost: "Unit cost (internal)",
                      discount: "Line discount",
                      tax_rate: "Tax percent",
                    }[name]
                  }
                />
              ))}
            </div>
          </FieldGroup>
        </section>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={pricing.fields.length >= 20}
        onClick={() =>
          pricing.append({
            description: "",
            quantity: "1",
            unit_price: "0",
            cost: "0",
            discount: "0",
            tax_rate: "0",
            service_id: "",
            supplier_id: "",
          })
        }
      >
        Add custom price line ({pricing.fields.length}/20)
      </Button>
    </div>
  );
}
