"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">We couldn’t load this page</h1>
      <p className="text-muted-foreground">
        Please try again. If the issue continues, contact your administrator.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
