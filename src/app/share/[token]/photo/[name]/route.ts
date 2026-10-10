import { z } from "zod";
import { getSharedItinerary } from "@/lib/itineraries/shared";
import { readPhoto, photoName } from "@/lib/itineraries/media";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; name: string }> },
) {
  const { token, name } = await params;
  if (!z.uuid().safeParse(token).success || !photoName.test(name))
    return new Response("Not found", { status: 404 });
  const input = await getSharedItinerary(token);
  const source = "/share/" + token + "/photo/" + name;
  if (
    !input ||
    ![input.cover_image, ...input.days.map((day) => day.image_url)].includes(
      source,
    )
  )
    return new Response("Not found", { status: 404 });
  const result = await readPhoto(name, true);
  return result
    ? new Response(new Uint8Array(result.bytes), {
        headers: {
          "Content-Type": result.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      })
    : new Response("Not found", { status: 404 });
}
