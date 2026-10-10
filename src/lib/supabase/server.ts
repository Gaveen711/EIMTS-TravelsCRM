import "server-only";
import { developmentWorkspace } from "@/lib/development/config";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
export async function createClient() {
  if (process.env.NODE_ENV === "development" && developmentWorkspace()) {
    const { createDevelopmentClient } =
      await import("@/lib/development/database");
    return createDevelopmentClient();
  }
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Read-only Server Components are refreshed by proxy. */
        }
      },
    },
  });
}
