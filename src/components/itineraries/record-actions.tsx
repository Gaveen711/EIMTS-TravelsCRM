"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quotationFromItinerary } from "@/lib/finance/actions";
import {
  duplicateItinerary,
  setItineraryShare,
} from "@/lib/itineraries/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
export function ItineraryRecordActions({
  id,
  token,
}: {
  id: string;
  token: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError("");
              const result = await quotationFromItinerary(id);
              if (result.error) setError(result.error);
              else router.push("/quotations/" + result.id);
            })
          }
        >
          Create quotation
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await duplicateItinerary(id);
              if (result.error) setError(result.error);
              else router.push("/itineraries/" + result.id + "/edit");
            })
          }
        >
          <Icon name="copy" />
          Duplicate
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setItineraryShare(id, !token);
              if (result.error) setError(result.error);
              else router.refresh();
            })
          }
        >
          <Icon name="share" />
          {token ? "Revoke sharing" : "Create share link"}
        </Button>
      </div>
      {token && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <a
            href={"/share/" + token}
            target="_blank"
            rel="noreferrer"
            className="break-all underline"
          >
            {typeof window !== "undefined" ? window.location.origin : ""}/share/
            {token}
          </a>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              navigator.clipboard
                .writeText(window.location.origin + "/share/" + token)
                .catch(() => setError("Copy the share link manually."))
            }
          >
            Copy link
          </Button>
          <span className="text-muted-foreground">
            Anyone with this link can view the brochure for 30 days.
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
