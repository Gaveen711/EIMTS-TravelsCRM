import "server-only";
import sharp from "sharp";
import { developmentWorkspace } from "@/lib/development/config";
import { createClient } from "@/lib/supabase/server";
import { logoMime, readDevelopmentLogo } from "./logo";

/** Load only workspace-owned storage bytes; PDF rendering never fetches user URLs. */
export async function loadPdfLogo(
  path?: string | null,
): Promise<string | null> {
  if (!path) return null;
  try {
    let bytes: Uint8Array;
    if (developmentWorkspace()) {
      if (!/^[a-f0-9]{64}\.image$/.test(path)) return null;
      bytes = await readDevelopmentLogo(path);
    } else {
      if (
        !/^company\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp)$/.test(
          path,
        )
      )
        return null;
      const db = await createClient();
      const { data, error } = await db.storage
        .from("company-logos")
        .download(path);
      if (error || !data || data.size > 2097152) return null;
      bytes = new Uint8Array(await data.arrayBuffer());
    }
    if (bytes.byteLength < 12 || bytes.byteLength > 2097152 || !logoMime(bytes))
      return null;
    const normalized = await sharp(bytes, { limitInputPixels: 20_000_000 })
      .rotate()
      .resize(160, 160, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return "data:image/png;base64," + normalized.toString("base64");
  } catch {
    return null;
  }
}
