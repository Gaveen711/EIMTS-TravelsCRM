import { requireManagePermission } from "@/lib/auth/authorize";
import { maxPhotoBytes, storePhoto } from "@/lib/itineraries/media";
export const runtime = "nodejs";
export async function POST(request: Request) {
  await requireManagePermission("itineraries");
  const maxBody = maxPhotoBytes + 65536;
  if (Number(request.headers.get("content-length")) > maxBody)
    return Response.json(
      { error: "Choose a photo up to 5 MB." },
      { status: 413 },
    );
  try {
    if (!request.body)
      return Response.json({ error: "Choose a photo." }, { status: 400 });
    const reader = request.body.getReader();
    const parts: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBody) {
        await reader.cancel();
        return Response.json(
          { error: "Choose a photo up to 5 MB." },
          { status: 413 },
        );
      }
      parts.push(value);
    }
    const body = new Uint8Array(Buffer.concat(parts));
    const form = await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("photo");
    if (!(file instanceof File) || !file.size || file.size > maxPhotoBytes)
      return Response.json(
        { error: "Choose a photo up to 5 MB." },
        { status: 400 },
      );
    const url = await storePhoto(new Uint8Array(await file.arrayBuffer()));
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Photo upload failed.",
      },
      { status: 400 },
    );
  }
}
