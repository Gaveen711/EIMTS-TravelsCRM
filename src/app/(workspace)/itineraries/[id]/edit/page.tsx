import { notFound } from "next/navigation";
import { z } from "zod";
import { loadCompany } from "@/lib/settings/data";
import { requirePermission } from "@/lib/auth/authorize";
import {
  getItinerary,
  itineraryForm,
  itineraryChoices,
} from "@/lib/itineraries/read";
import { ItineraryEditor } from "@/components/itineraries/editor";
export default async function EditItinerary({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("itineraries");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [result, choices, company] = await Promise.all([
    getItinerary(id),
    itineraryChoices(),
    loadCompany(),
  ]);
  if (!result) notFound();
  return (
    <ItineraryEditor
      id={id}
      companyName={company?.company_name}
      initial={itineraryForm(result.record, result.days)}
      {...choices}
    />
  );
}
