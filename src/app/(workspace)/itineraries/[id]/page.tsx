import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadCompany } from "@/lib/settings/data";
import { requirePermission } from "@/lib/auth/authorize";
import { getItinerary, itineraryForm } from "@/lib/itineraries/read";
import { ItineraryPreview } from "@/components/itineraries/preview";
import { ItineraryRecordActions } from "@/components/itineraries/record-actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
export default async function ItineraryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("itineraries");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [result, company] = await Promise.all([
    getItinerary(id),
    loadCompany(),
  ]);
  if (!result) notFound();
  const input = itineraryForm(result.record, result.days);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {input.reference || "Saved itinerary"}
          </p>
          <h1 className="text-3xl font-semibold">{input.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={"/itineraries/" + id + "/edit"}>
              <Icon name="pencil" />
              Edit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a
              href={"/itineraries/" + id + "/pdf?preview=1"}
              target="_blank"
              rel="noreferrer"
            >
              Preview PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={"/itineraries/" + id + "/pdf"}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="file-earmark-pdf" />
              Export PDF
            </a>
          </Button>
        </div>
      </header>
      {input.days.some((day) => !day.reviewed) && (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">
          Review {input.days.filter((day) => !day.reviewed).length} day(s)
          before sending this itinerary to your customer.
        </p>
      )}
      <ItineraryRecordActions id={id} token={result.record.share_token} />
      <ItineraryPreview input={input} companyName={company?.company_name} />
    </div>
  );
}
