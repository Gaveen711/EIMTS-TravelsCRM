"use client";
import { useId, useState } from "react";
import { photoLibrary } from "@/lib/itineraries/photo-library";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
export function PhotoPicker({
  onChoose,
}: {
  onChoose: (photo: { url: string; alt: string; credit: string }) => void;
}) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose a JPEG or PNG photo up to 5 MB.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const form = new FormData();
      form.set("photo", file);
      const response = await fetch("/api/itineraries/photos", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.url)
        throw new Error(result.error || "Photo upload failed.");
      onChoose({
        url: result.url,
        alt: file.name.replace(/\.[^.]+$/, ""),
        credit:
          "Photo supplied by the travel consultant. Confirm usage rights.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={id}>Destination photo library</FieldLabel>
        <select
          id={id}
          defaultValue=""
          className="rounded-lg border bg-background p-2 text-sm"
          onChange={(event) => {
            const photo = photoLibrary.find(
              (photo) => photo.id === event.target.value,
            );
            if (photo)
              onChoose({
                url: photo.src,
                alt: photo.destination,
                credit: photo.credit + " · " + photo.source,
              });
            event.target.value = "";
          }}
        >
          <option value="">Choose a source photograph…</option>
          {photoLibrary.map((photo) => (
            <option key={photo.id} value={photo.id}>
              {photo.destination}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={id + "-upload"}>Upload your own photo</FieldLabel>
        <input
          type="file"
          id={id + "-upload"}
          accept="image/jpeg,image/png"
          disabled={pending}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {pending
            ? "Uploading…"
            : "JPEG or PNG, up to 5 MB. Uploaded photos persist with the itinerary."}
        </p>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChoose({ url: "", alt: "", credit: "" })}
      >
        Clear photo
      </Button>
    </FieldGroup>
  );
}
