"use client";
import {
  useDeferredValue,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Service } from "@/lib/catalog/schema";
import { supportedCurrencies } from "@/lib/catalog/schema";
import {
  itinerarySchema,
  themes,
  type ItineraryInput,
} from "@/lib/itineraries/schema";
import { saveItinerary } from "@/lib/itineraries/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { EditorField } from "./field";
import { DayEditor } from "./day-editor";
import { PricingEditor } from "./pricing-editor";
import { ItineraryPreview } from "./preview";
import { PhotoPicker } from "./photo-picker";
import { Icon } from "@/components/icon";
const subscribe = () => () => {};
const ready = () => true;
const notReady = () => false;
const tabs = ["Trip", "Days", "Pricing", "Design", "Route", "Terms"] as const;
export function ItineraryEditor({
  initial,
  id,
  customers,
  services,
  companyName,
}: {
  initial: ItineraryInput;
  id?: string;
  customers: { id: string; name: string }[];
  services: Service[];
  companyName?: string;
}) {
  const hydrated = useSyncExternalStore(subscribe, ready, notReady);
  const form = useForm<ItineraryInput>({
    resolver: zodResolver(itinerarySchema),
    defaultValues: initial,
  });
  const days = useFieldArray({ control: form.control, name: "days" });
  const pricing = useFieldArray({ control: form.control, name: "pricing" });
  const watched = useWatch({ control: form.control }) as ItineraryInput;
  const preview = useDeferredValue(watched);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Trip");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [zoom, setZoom] = useState(100);
  const router = useRouter();
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [form.formState.isDirty]);
  const submit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        setError("");
        const result = await saveItinerary(values, id);
        if (result.error) setError(result.error);
        else if (result.id) {
          form.reset(values);
          router.push("/itineraries/" + result.id);
        }
      }),
    () => {
      const fields = Object.keys(form.formState.errors);
      setTab(
        fields.includes("days")
          ? "Days"
          : fields.includes("pricing")
            ? "Pricing"
            : fields.some(
                  (key) => key.includes("color") || key.startsWith("cover"),
                )
              ? "Design"
              : "Trip",
      );
      setError("Some fields need attention. Review the highlighted errors.");
    },
  );
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset disabled={!hydrated || pending} className="contents">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Brochure studio</p>
            <h1 className="text-3xl font-semibold">
              {id ? "Edit itinerary" : "Create itinerary"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Shape the journey, then turn it into a quotation.
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            <Icon name="floppy" />
            {pending ? "Saving…" : "Save itinerary"}
          </Button>
        </header>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="min-w-0 rounded-xl border bg-card p-4">
            <nav
              aria-label="Itinerary editor sections"
              className="mb-5 flex flex-wrap gap-2"
            >
              {tabs.map((name) => (
                <Button
                  key={name}
                  type="button"
                  variant={tab === name ? "default" : "outline"}
                  onClick={() => setTab(name)}
                  aria-pressed={tab === name}
                >
                  {name}
                </Button>
              ))}
            </nav>
            {tab === "Trip" && (
              <FieldGroup>
                <Field data-invalid={!!form.formState.errors.customer_id}>
                  <FieldLabel htmlFor="customer_id">Customer</FieldLabel>
                  <select
                    id="customer_id"
                    {...form.register("customer_id")}
                    aria-invalid={!!form.formState.errors.customer_id}
                    className="rounded-lg border bg-background p-2"
                  >
                    <option value="">Choose a customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    errors={
                      form.formState.errors.customer_id
                        ? [form.formState.errors.customer_id]
                        : undefined
                    }
                  />
                  {!customers.length && (
                    <p className="text-sm text-muted-foreground">
                      Add a customer first under Customers.
                    </p>
                  )}
                </Field>
                <EditorField form={form} name="title" label="Trip title" />
                <EditorField
                  form={form}
                  name="destination"
                  label="Destination"
                />
                <EditorField form={form} name="reference" label="Reference" />
                <EditorField
                  form={form}
                  name="start_date"
                  label="Start date"
                  type="date"
                />
                <div className="grid grid-cols-2 gap-3">
                  <EditorField
                    form={form}
                    name="adults"
                    label="Adults"
                    type="number"
                  />
                  <EditorField
                    form={form}
                    name="children"
                    label="Children"
                    type="number"
                  />
                </div>
                <Field>
                  <FieldLabel htmlFor="currency">Currency</FieldLabel>
                  <select
                    id="currency"
                    {...form.register("currency")}
                    className="rounded-lg border bg-background p-2"
                  >
                    {supportedCurrencies.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <EditorField
                  form={form}
                  name="summary"
                  label="Welcome / introduction"
                  multiline
                />
                <EditorField
                  form={form}
                  name="arrangements"
                  label="Special arrangements"
                  multiline
                />
                <EditorField
                  form={form}
                  name="consultant"
                  label="Travel consultant"
                />
                <EditorField
                  form={form}
                  name="consultant_email"
                  label="Consultant email"
                />
                <EditorField
                  form={form}
                  name="consultant_phone"
                  label="Consultant phone"
                />
              </FieldGroup>
            )}
            {tab === "Days" && <DayEditor form={form} days={days} />}
            {tab === "Pricing" && (
              <PricingEditor
                form={form}
                pricing={pricing}
                services={services}
              />
            )}
            {tab === "Design" && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="theme">Color palette</FieldLabel>
                  <select
                    id="theme"
                    className="rounded-lg border bg-background p-2"
                    defaultValue={initial.theme_name}
                    onChange={(event) => {
                      const theme = themes.find(
                        (t) => t.name === event.target.value,
                      );
                      if (theme) {
                        form.setValue("theme_name", theme.name, {
                          shouldDirty: true,
                        });
                        form.setValue("primary_color", theme.primary);
                        form.setValue("accent_color", theme.accent);
                      }
                    }}
                  >
                    {themes.map((t) => (
                      <option key={t.name}>{t.name}</option>
                    ))}
                  </select>
                </Field>
                <EditorField
                  form={form}
                  name="primary_color"
                  label="Custom primary color"
                  type="color"
                />
                <EditorField
                  form={form}
                  name="accent_color"
                  label="Custom accent color"
                  type="color"
                />
                <PhotoPicker
                  onChoose={(photo) => {
                    form.setValue("cover_image", photo.url, {
                      shouldDirty: true,
                    });
                    form.setValue("cover_alt", photo.alt);
                    form.setValue("cover_credit", photo.credit);
                  }}
                />
                <EditorField
                  form={form}
                  name="cover_image"
                  label="Cover photo URL"
                />
                <EditorField
                  form={form}
                  name="cover_alt"
                  label="Cover photo description"
                />
                <EditorField
                  form={form}
                  name="cover_credit"
                  label="Cover photo credits and license"
                />
              </FieldGroup>
            )}
            {tab === "Route" && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="route_mode">Route order</FieldLabel>
                  <select
                    id="route_mode"
                    {...form.register("route_mode")}
                    className="rounded-lg border bg-background p-2"
                  >
                    <option value="automatic">From day destinations</option>
                    <option value="custom">Custom sequence</option>
                  </select>
                </Field>
                <EditorField form={form} name="arrival" label="Arrival point" />
                <EditorField
                  form={form}
                  name="departure"
                  label="Departure point"
                />
                <Field>
                  <FieldLabel htmlFor="custom-stops">
                    Custom stops (one per line, up to 40)
                  </FieldLabel>
                  <textarea
                    id="custom-stops"
                    rows={6}
                    className="rounded-lg border bg-background p-2"
                    defaultValue={initial.custom_stops.join("\n")}
                    onChange={(event) =>
                      form.setValue(
                        "custom_stops",
                        event.target.value
                          .split("\n")
                          .map((v) => v.trim())
                          .filter(Boolean),
                        { shouldDirty: true },
                      )
                    }
                  />
                </Field>
              </FieldGroup>
            )}
            {tab === "Terms" && (
              <FieldGroup>
                <EditorField
                  form={form}
                  name="inclusions"
                  label="Inclusions"
                  multiline
                />
                <EditorField
                  form={form}
                  name="exclusions"
                  label="Exclusions"
                  multiline
                />
                <EditorField
                  form={form}
                  name="terms"
                  label="Terms and conditions"
                  multiline
                />
              </FieldGroup>
            )}
            <p className="mt-5 text-xs text-muted-foreground">
              {watched.days?.filter((d) => !d.reviewed).length} days await
              review. Changes to a destination clear its photo and review flag.
            </p>
          </section>
          <aside className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Live preview</h2>
              <label className="flex items-center gap-2 text-sm">
                Zoom
                <select
                  aria-label="Preview zoom"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="rounded border bg-background p-1"
                >
                  <option value={80}>80%</option>
                  <option value={100}>100%</option>
                  <option value={120}>120%</option>
                </select>
              </label>
            </div>
            <div style={{ fontSize: zoom + "%" }}>
              <ItineraryPreview
                input={preview}
                companyName={companyName}
                customerName={
                  customers.find((c) => c.id === preview.customer_id)?.name
                }
              />
            </div>
          </aside>
        </div>
      </fieldset>
    </form>
  );
}
