import { requirePermission } from "@/lib/auth/authorize";
import { readPhoto } from "@/lib/itineraries/media";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  await requirePermission("itineraries");
  const { name } = await params;
  const result = await readPhoto(name);
  return result
    ? new Response(new Uint8Array(result.bytes), {
        headers: {
          "Content-Type": result.mime,
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      })
    : new Response("Photo not found", { status: 404 });
}
