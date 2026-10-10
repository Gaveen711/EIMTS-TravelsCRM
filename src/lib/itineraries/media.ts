import "server-only";
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { developmentWorkspace } from "@/lib/development/config";
import { createClient } from "@/lib/supabase/server";
import { createClient as supabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";

export const maxPhotoBytes = 5 * 1024 * 1024;
export function photoMime(bytes: Uint8Array) {
  if (bytes.length > maxPhotoBytes) return null;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image/png";
  return null;
}
export const photoName =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/;
function directory() {
  return resolve(
    process.env.CRM_LOCAL_DATA_DIR || ".crm-data",
    "itinerary-images",
  );
}
export async function storePhoto(bytes: Uint8Array) {
  const mime = photoMime(bytes);
  if (!mime) throw new Error("Choose a JPEG or PNG photo up to 5 MB.");
  let normalized: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 20000000, failOn: "error" })
      .rotate()
      .resize({
        width: 1400,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
      });
    normalized = await (
      mime === "image/jpeg"
        ? image.jpeg({ quality: 82, mozjpeg: true })
        : image.png({ compressionLevel: 9 })
    ).toBuffer();
  } catch {
    throw new Error(
      "Choose a valid JPEG or PNG image with at most 20 million pixels.",
    );
  }
  const name = randomUUID() + (mime === "image/jpeg" ? ".jpg" : ".png");
  if (developmentWorkspace()) {
    await mkdir(directory(), { recursive: true });
    await writeFile(resolve(directory(), name), normalized);
  } else {
    const client = await createClient();
    const { error } = await client.storage
      .from("itinerary-images")
      .upload("itineraries/" + name, normalized, {
        contentType: mime,
        upsert: false,
      });
    if (error) throw new Error("The photo could not be uploaded.");
  }
  return "/api/itineraries/photos/" + name;
}
export async function readPhoto(name: string, shared = false) {
  if (!photoName.test(name)) return null;
  try {
    let bytes: Uint8Array;
    if (developmentWorkspace())
      bytes = new Uint8Array(await readFile(resolve(directory(), name)));
    else {
      const config = supabaseConfig();
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (shared && (!config || !key)) return null;
      const client =
        shared && config && key
          ? supabaseClient(config.url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
            })
          : await createClient();
      const { data, error } = await client.storage
        .from("itinerary-images")
        .download("itineraries/" + name);
      if (error || !data) return null;
      bytes = new Uint8Array(await data.arrayBuffer());
    }
    const mime = photoMime(bytes);
    return mime ? { bytes, mime } : null;
  } catch {
    return null;
  }
}
