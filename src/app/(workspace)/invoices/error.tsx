"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-xl border bg-card p-6" role="alert">
      <h1 className="text-xl font-semibold">Unable to load documents</h1>
      <p className="my-3 text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
