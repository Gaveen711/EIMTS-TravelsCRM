import { requirePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { developmentWorkspace } from "@/lib/development/config";
import { readDevelopmentLogo, logoMime } from "@/lib/settings/logo";
export async function GET() {
  await requirePermission("dashboard");
  const db = await createClient();
  const { data, error } = await db
    .from("settings")
    .select("logo_path")
    .eq("id", 1)
    .single();
  if (error || !data?.logo_path) return new Response(null, { status: 404 });
  try {
    if (developmentWorkspace()) {
      const bytes = await readDevelopmentLogo(data.logo_path);
      return new Response(bytes, {
        headers: {
          "Content-Type": logoMime(bytes) || "application/octet-stream",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const { data: signed, error: storageError } = await db.storage
      .from("company-logos")
      .createSignedUrl(data.logo_path, 60);
    if (storageError || !signed) return new Response(null, { status: 404 });
    return Response.redirect(signed.signedUrl);
  } catch {
    return new Response(null, { status: 404 });
  }
}
