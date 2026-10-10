import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readPhoto, photoMime, maxPhotoBytes } from "./media";
import { photoLibrary } from "./photo-library";
function imageData(bytes: Uint8Array) {
  const mime = photoMime(bytes);
  return mime
    ? "data:" + mime + ";base64," + Buffer.from(bytes).toString("base64")
    : null;
}
export async function pdfPhotos(urls: string[]) {
  const photos: Record<string, string> = {};
  // Local library assets and uploaded photos avoid remote requests and PDF SSRF.
  for (const source of [...new Set(urls.filter(Boolean))].slice(0, 31)) {
    try {
      let bytes: Uint8Array | undefined;
      if (source.startsWith("/api/itineraries/photos/"))
        bytes = (await readPhoto(source.split("/").pop()!))?.bytes;
      else if (photoLibrary.some((photo) => photo.src === source))
        bytes = new Uint8Array(
          await readFile(resolve("public", source.slice(1))),
        );
      // A strict host allowlist bounds PDF network access. Other HTTPS URLs remain web-preview only.
      else {
        const url = new URL(source);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "upload.wikimedia.org" ||
          url.username ||
          url.password ||
          (url.port && url.port !== "443")
        )
          continue;
        const response = await fetch(source, {
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        if (
          !response.ok ||
          Number(response.headers.get("content-length")) > maxPhotoBytes ||
          !response.body
        )
          continue;
        const reader = response.body.getReader();
        const parts: Uint8Array[] = [];
        let length = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maxPhotoBytes) {
            await reader.cancel();
            break;
          }
          parts.push(value);
        }
        if (length <= maxPhotoBytes) bytes = Buffer.concat(parts);
      }
      if (bytes) {
        const value = imageData(bytes);
        if (value) photos[source] = value;
      }
    } catch {
      /* Missing photos leave the brochure text intact. */
    }
  }
  return photos;
}
