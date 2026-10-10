import { notFound } from "next/navigation";
import { z } from "zod";
import { getSharedItinerary } from "@/lib/itineraries/shared";
import { ItineraryPreview } from "@/components/itineraries/preview";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Your travel itinerary",
};
export default async function SharedItinerary({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();
  const input = await getSharedItinerary(token, true);
  if (!input) notFound();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header>
        <p className="text-sm text-muted-foreground">
          Prepared by {input.companyName}
        </p>
        <h1 className="font-serif text-3xl">Your personal journey</h1>
      </header>
      <ItineraryPreview input={input} companyName={input.companyName} shared />
    </main>
  );
}
