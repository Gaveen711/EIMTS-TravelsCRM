import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { developmentWorkspace } from "@/lib/development/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (
    developmentWorkspace() ||
    request.nextUrl.pathname === "/access-required" ||
    request.nextUrl.pathname.startsWith("/share/") ||
    request.nextUrl.pathname.startsWith("/itinerary-photos/") ||
    request.nextUrl.pathname === "/icons.svg"
  )
    return response;
  const config = supabaseConfig();
  const deny = () =>
    NextResponse.redirect(new URL("/access-required", request.url));
  if (!config) return deny();
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  return error || !data?.claims ? deny() : response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
