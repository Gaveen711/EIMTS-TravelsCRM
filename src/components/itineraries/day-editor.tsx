"use client";
import { useState } from "react";
import type { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import type { ItineraryInput } from "@/lib/itineraries/schema";
import { blankDay } from "@/lib/itineraries/schema";
import { Button } from "@/components/ui/button";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { EditorField } from "./field";
import { PhotoPicker } from "./photo-picker";
import { Icon } from "@/components/icon";
export function DayEditor({
  form,
  days,
}: {
  form: UseFormReturn<ItineraryInput>;
  days: UseFieldArrayReturn<ItineraryInput, "days">;
}) {
  const [activeDay, setActiveDay] = useState(0);
  const selected = Math.min(activeDay, days.fields.length - 1);
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Itinerary days" className="flex flex-wrap gap-2">
        {days.fields.map((day, index) => (
          <Button
            key={day.id}
            type="button"
            size="sm"
            variant={selected === index ? "default" : "outline"}
            aria-pressed={selected === index}
            onClick={() => setActiveDay(index)}
          >
            Day {index + 1}
          </Button>
        ))}
      </nav>
      {days.fields.map(
        (day, index) =>
          selected === index && (
            <section key={day.id} className="rounded-xl border p-4">
              <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Day {index + 1}</h3>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={"Move day " + (index + 1) + " up"}
                    disabled={!index}
                    onClick={() => {
                      days.move(index, index - 1);
                      setActiveDay(index - 1);
                    }}
                  >
                    <Icon name="arrow-up" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={"Move day " + (index + 1) + " down"}
                    disabled={index === days.fields.length - 1}
                    onClick={() => {
                      days.move(index, index + 1);
                      setActiveDay(index + 1);
                    }}
                  >
                    <Icon name="arrow-down" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={days.fields.length === 1}
                    onClick={() => {
                      if (window.confirm("Remove this day?"))
                        days.remove(index);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </header>
              <FieldGroup>
                <EditorField
                  form={form}
                  name={`days.${index}.destination`}
                  label="Destination"
                  onChange={() => {
                    form.setValue(`days.${index}.reviewed`, false);
                    form.setValue(`days.${index}.image_url`, "");
                    form.setValue(`days.${index}.photo_alt`, "");
                    form.setValue(`days.${index}.photo_credit`, "");
                  }}
                />
                <EditorField
                  form={form}
                  name={`days.${index}.title`}
                  label="Day title"
                />
                <EditorField
                  form={form}
                  name={`days.${index}.description`}
                  label="Day narrative"
                  multiline
                />
                {(["morning", "afternoon", "evening"] as const).map((time) => (
                  <EditorField
                    key={time}
                    form={form}
                    name={`days.${index}.${time}`}
                    label={time[0].toUpperCase() + time.slice(1)}
                    multiline
                  />
                ))}
                <EditorField
                  form={form}
                  name={`days.${index}.accommodation`}
                  label="Hotel / accommodation"
                />
                <EditorField
                  form={form}
                  name={`days.${index}.rooms`}
                  label="Rooms"
                />
                <EditorField
                  form={form}
                  name={`days.${index}.meals`}
                  label="Meal plan"
                />
                <PhotoPicker
                  onChoose={(photo) => {
                    form.setValue(`days.${index}.image_url`, photo.url, {
                      shouldDirty: true,
                    });
                    form.setValue(`days.${index}.photo_alt`, photo.alt);
                    form.setValue(`days.${index}.photo_credit`, photo.credit);
                    form.setValue(`days.${index}.reviewed`, false);
                  }}
                />
                <EditorField
                  form={form}
                  name={`days.${index}.image_url`}
                  label="Photo URL"
                />
                <EditorField
                  form={form}
                  name={`days.${index}.photo_alt`}
                  label="Photo description"
                />
                <EditorField
                  form={form}
                  name={`days.${index}.photo_credit`}
                  label="Photo credits and license"
                />
                <div className="grid grid-cols-2 gap-3">
                  <EditorField
                    form={form}
                    name={`days.${index}.focal_x`}
                    label="Photo focus X (0–100)"
                    type="number"
                  />
                  <EditorField
                    form={form}
                    name={`days.${index}.focal_y`}
                    label="Photo focus Y (0–100)"
                    type="number"
                  />
                </div>
                <Field orientation="horizontal">
                  <input
                    type="checkbox"
                    id={"reviewed-" + index}
                    {...form.register(`days.${index}.reviewed`)}
                  />
                  <FieldLabel htmlFor={"reviewed-" + index}>
                    I reviewed this day&apos;s destination, details and image
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </section>
          ),
      )}
      <Button
        type="button"
        variant="outline"
        disabled={days.fields.length >= 30}
        onClick={() => {
          days.append({
            ...blankDay(),
            title: "Day " + (days.fields.length + 1),
          });
          setActiveDay(days.fields.length);
        }}
      >
        <Icon name="plus" />
        Add day ({days.fields.length}/30)
      </Button>
    </div>
  );
}
