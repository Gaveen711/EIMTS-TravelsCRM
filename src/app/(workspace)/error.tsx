"use client";
import { Button } from "@/components/ui/button";
export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="work-panel" role="alert">
      <h1 className="text-xl font-semibold">This page could not be loaded</h1>
      <p className="my-4 text-sm text-muted-foreground">
        Try again. If this continues, check the database connection and
        migrations.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
