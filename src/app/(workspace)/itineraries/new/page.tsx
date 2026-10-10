import { loadCompany } from "@/lib/settings/data";
import { requirePermission } from "@/lib/auth/authorize";
import { itineraryChoices } from "@/lib/itineraries/read";
import { blankItinerary } from "@/lib/itineraries/schema";
import { ItineraryEditor } from "@/components/itineraries/editor";
export default async function NewItinerary() {
  await requirePermission("itineraries");
  const [choices, company] = await Promise.all([
    itineraryChoices(),
    loadCompany(),
  ]);
  return (
    <ItineraryEditor
      initial={blankItinerary()}
      companyName={company?.company_name}
      {...choices}
    />
  );
}
