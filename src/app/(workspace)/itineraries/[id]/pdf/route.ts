import { requirePermission } from "@/lib/auth/authorize";
import { getItinerary, itineraryForm } from "@/lib/itineraries/read";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadPdfLogo } from "@/lib/settings/pdf-logo";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePermission("itineraries");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  try {
    const client = await createClient();
    const [result, settings] = await Promise.all([
      getItinerary(id),
      client
        .from("settings")
        .select("company_name,logo_path")
        .eq("id", 1)
        .single(),
    ]);
    if (!result) return new Response("Not found", { status: 404 });
    const input = itineraryForm(result.record, result.days);
    const [{ renderToBuffer }, { ItineraryPdf }, { pdfPhotos }] =
      await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/itineraries/pdf"),
        import("@/lib/itineraries/photos"),
      ]);
    const [photos, logo] = await Promise.all([
      pdfPhotos([input.cover_image, ...input.days.map((d) => d.image_url)]),
      loadPdfLogo(settings.data?.logo_path),
    ]);
    const companyName =
      settings.data?.company_name?.trim() || "Emerald Isle Travels";
    const document = ItineraryPdf({ input, photos, companyName, logo });
    const bytes = await renderToBuffer(document);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          (new URL(request.url).searchParams.get("preview") === "1"
            ? "inline"
            : "attachment") +
          '; filename="itinerary-' +
          id +
          '.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("The PDF could not be generated. Please try again.", {
      status: 503,
    });
  }
}
