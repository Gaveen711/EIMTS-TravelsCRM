"use client";
import { Button } from "@/components/ui/button";
export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border p-6">
      <h2 className="font-semibold">
        The itinerary workspace could not be loaded.
      </h2>
      <p className="my-3 text-sm text-muted-foreground">
        Your saved itineraries remain in the database.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
