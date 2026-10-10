"use client";
import { useState, useTransition } from "react";
import { emailDocument } from "@/lib/email/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
export function EmailDocument({
  kind,
  id,
}: {
  kind: "quotations" | "invoices";
  id: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: string }>(
    {},
  );
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => setResult(await emailDocument(kind, id)))
        }
      >
        <Icon name="envelope" />
        {pending ? "Sending…" : "Email PDF"}
      </Button>
      {(result.error || result.success) && (
        <p role="status" className="max-w-sm text-xs text-muted-foreground">
          {result.error || result.success}
        </p>
      )}
    </div>
  );
}
